import { Injectable, Logger } from '@nestjs/common';
import {
  addDays,
  cutoffInstant,
  isCompanyDeliveryDay,
  kitchenToday,
} from '@repo/shared';
import type { CalendarDate } from '@repo/shared';
import { PrismaService } from '../../database/prisma.service.js';
import { BillingService } from '../billing/billing.service.js';
import { ClockService } from '../../common/clock/clock.service.js';
import { DispatchService } from '../dispatch/dispatch.service.js';
import { KitchenService } from '../kitchen/kitchen.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import { StaffService } from '../staff/staff.service.js';
import { MenuService } from '../menu/menu.service.js';
import { logAction } from '../../common/logging/logging.interceptor.js';

/**
 * Demo data part 2: orders in every status, driver drops, invoices.
 * PDF §2 + skill seed-demo-data. D-77.
 *
 * Built ONLY through the real services (totals reconcile); every
 * date derives from `kitchenToday(now)` plus an offset (review day
 * unknown). Demo orders are created by the inactive system staff
 * user `seed@fernleaf.test`, so a refresh touches only demo data.
 * Draft/Placed live only on dates whose cut-off is still future;
 * past-cut-off dates hold Confirmed/Delivered/Cancelled/Rejected
 * (settled honestly through `runCutoff`, never by status edits).
 * Custom delivery times appear only for employees holding
 * `canChangeDeliveryTime` (D-59, checked live); everyone else
 * takes company defaults.
 *
 * Algorithm (convergent — every step checks current state first):
 *   1. Ensure the marker user (inactive) + pick date-relative targets.
 *   2. Create only for target dates holding no seed orders yet.
 *   3. `runCutoff(realNow)`: past/today targets settle honestly.
 *   4. Reject one past order (once ever), cancel one future draft
 *      (once ever), deliver past drops member-complete, invoice to
 *      one unpaid + one paid (once each). Partial runs and reruns
 *      complete the set without duplicates.
 * Invariants: a second run on overlapping dates creates zero rows
 * (seed orders already cover today and the future); reviewer rows
 * (other creators) are never gated on, never written.
 * Edge cases: no company serves today (e.g. Sunday) skips the
 * today section; reviewer-edited cut-off settings shift targets
 * through the same live computation reviewers get.
 */

const SEED_EMAIL = 'seed@fernleaf.test';

export interface DemoCounts {
  orders: number;
  invoices: number;
  skipped: boolean;
}

interface CutoffView {
  kitchenWorkingDays: number[];
  cutoffTimeMinute: number;
  cutoffWorkingDays: number;
}

interface SeedLine {
  dishId: string;
  combinations: Array<{ quantity: number; choices: Array<{ optionId: string }> }>;
}

/**
 * Demo data top-up. PDF §2 + skill seed-demo-data.
 *
 * Runs on boot and from the admin refresh action. Cheap when
 * today's set exists (a few reads, zero writes); otherwise builds
 * the full matrix through the real services. See part-2 algorithm
 * notes on the helpers below.
 */
@Injectable()
export class DemoDataService {
  private readonly logger = new Logger(DemoDataService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly orders: OrdersService,
    private readonly kitchen: KitchenService,
    private readonly dispatch: DispatchService,
    private readonly billing: BillingService,
    private readonly staff: StaffService,
    private readonly menu: MenuService,
    private readonly clock: ClockService,
  ) {}

  async ensureDemoData(): Promise<DemoCounts> {
    const prisma = this.prisma;
    const now = this.clock.now();
    const logger = this.logger;
    const today = kitchenToday(now);
    const seedUser = await this.ensureMarkerUser();
  // Boot safety: part 1 (companies, dishes) may not exist on a fresh
  // database that was never seeded — skip instead of crashing boot.
  const [companyCount, dishCount] = await Promise.all([
    prisma.company.count(),
    prisma.dish.count(),
  ]);
  if (companyCount === 0 || dishCount === 0) {
    logAction(logger, 'seed.part-2.skipped', { reason: 'part-1-missing' });
    return { orders: 0, invoices: 0, skipped: true };
  }
  const settings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: 1 } });
  const kitchenHolidays = (
    await prisma.kitchenHoliday.findMany({ select: { date: true } })
  ).map((row) => toCalendarDate(row.date));
  const cutoff: CutoffView = {
    kitchenWorkingDays: settings.kitchenWorkingDays,
    cutoffTimeMinute: settings.cutoffTimeMinute,
    cutoffWorkingDays: settings.cutoffWorkingDays,
  };

  const acme = await prisma.company.findFirstOrThrow({
    where: { domains: { some: { domain: 'acme-foods.example' } } },
    select: { id: true, workingDays: true },
  });
  const globex = await prisma.company.findFirstOrThrow({
    where: { domains: { some: { domain: 'globex-logistics.example' } } },
    select: { id: true, workingDays: true },
  });
  const acmeHolidays = (
    await prisma.companyHoliday.findMany({ where: { companyId: acme.id }, select: { date: true } })
  ).map((row) => toCalendarDate(row.date));

  const acmePast = recentDeliveryDays(today, acme.workingDays, acmeHolidays, 2);
  const globexPast = recentDeliveryDays(today, globex.workingDays, [], 1);
  const future = upcomingOpenDates(today, now, cutoff, kitchenHolidays, acme.workingDays, acmeHolidays, 2);
  const acmePastFar = acmePast[1];
  const acmePastNear = acmePast[0];
  const globexPastDay = globexPast[0];
  const futureNear = future[0];
  const futureFar = future[1];
  if (
    acmePastFar === undefined ||
    acmePastNear === undefined ||
    globexPastDay === undefined ||
    futureNear === undefined ||
    futureFar === undefined
  ) {
    logAction(logger, 'seed.part-2.skipped', { reason: 'no-suitable-dates' });
    return { orders: 0, invoices: 0, skipped: true };
  }

  // Convergence: every step checks current state first, so reruns
  // (and yesterday's partial runs) complete the set without dupes.
  // Creation is gated per date; finishes derive from live rows.
  async function dateCovered(date: CalendarDate): Promise<boolean> {
    const count = await prisma.order.count({
      where: { createdById: seedUser.id, deliveryDate: new Date(`${date}T00:00:00.000Z`) },
    });
    return count > 0;
  }

  const backdatedClock = new ClockService();
  backdatedClock.setNow(new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000));
  const pricing = this.pricing;
  const ordersBackdated = new OrdersService(prisma, pricing, backdatedClock);
  const ordersLive = this.orders;
  const kitchen = this.kitchen;
  const dispatch = this.dispatch;
  const billing = this.billing;
  const admin = await prisma.staffUser.findUniqueOrThrow({ where: { email: 'admin@test.com' } });
  const driver = await prisma.staffUser.findUniqueOrThrow({ where: { email: 'driver@test.com' } });

  const riya = await prisma.employee.findUniqueOrThrow({ where: { email: 'riya.shah@acme-foods.example' } });
  const karan = await prisma.employee.findUniqueOrThrow({ where: { email: 'karan.mehta@acme-foods.example' } });
  const sam = await prisma.employee.findUniqueOrThrow({ where: { email: 'sam.dsouza@globex-logistics.example' } });
  const menu = this.menu;
  // Lines come from the live employee preview (the orderability
  // oracle): whatever the catalogue currently offers, including
  // required-group choices and minimum quantities.
  async function previewLine(employeeId: string, quantity: number): Promise<SeedLine | null> {
    const preview = await menu.preview(employeeId, null);
    const item = preview.categories.flatMap((category) => category.items)[0];
    if (item === undefined) {
      return null;
    }
    return {
      dishId: item.dishId,
      combinations: [
        {
          quantity: Math.max(quantity, item.minOrderQuantity ?? 1),
          choices: item.groups
            .filter((group) => group.isRequired)
            .map((group) => ({ optionId: group.options[0]?.id ?? '' }))
            .filter((choice) => choice.optionId !== ''),
        },
      ],
    };
  }
  async function bowl(employeeId: string, quantity: number): Promise<SeedLine> {
    const line = await previewLine(employeeId, quantity);
    if (line === null) {
      throw new Error('Seed has no orderable dish for employee');
    }
    return line;
  }

  let created = 0;
  async function draft(
    employeeId: string,
    deliveryDate: CalendarDate,
    lines: SeedLine[],
    timeMinute?: number,
  ): Promise<string> {
    const details =
      timeMinute === undefined
        ? undefined
        : await timedDetails(prisma, employeeId, timeMinute);
    const order = await ordersBackdated.createOrder(seedUser.id, {
      employeeId,
      deliveryDate,
      ...(details === undefined ? {} : { details }),
      lines,
    });
    created += 1;
    return order.id;
  }
  async function placed(
    employeeId: string,
    deliveryDate: CalendarDate,
    lines: SeedLine[],
    timeMinute?: number,
  ): Promise<string> {
    const id = await draft(employeeId, deliveryDate, lines, timeMinute);
    const row = await prisma.order.findUniqueOrThrow({ where: { id }, select: { version: true } });
    await ordersBackdated.placeOrder(id, seedUser.id, row.version);
    return id;
  }

  // Past Acme: two delivered, one job-cancelled draft, one rejected.
  if (!(await dateCovered(acmePastFar))) {
    await placed(riya.id, acmePastFar, [await bowl(riya.id, 2)]);
    await placed(karan.id, acmePastFar, [await bowl(karan.id, 2)]);
    await draft(riya.id, acmePastFar, [await bowl(riya.id, 1)]);
  }
  if (!(await dateCovered(acmePastNear))) {
    await placed(karan.id, acmePastNear, [await bowl(karan.id, 1)]);
  }
  // Past Globex: two delivered (paid invoice below).
  if (!(await dateCovered(globexPastDay))) {
    await placed(sam.id, globexPastDay, [await bowl(sam.id, 1)]);
    await placed(sam.id, globexPastDay, [await bowl(sam.id, 3)]);
  }
  // Future Acme: open placed + one draft cancelled explicitly below.
  if (!(await dateCovered(futureNear))) {
    await placed(riya.id, futureNear, [await bowl(riya.id, 2)]);
  }
  if (!(await dateCovered(futureFar))) {
    await placed(karan.id, futureFar, [await bowl(karan.id, 3)]);
    await draft(sam.id, futureFar, [await bowl(sam.id, 1)]);
  }

  // Settle past targets honestly through cut-off processing.
  await ordersLive.runCutoff(now);

  // Rejected: first past CONFIRMED seed order, once ever.
  const rejectedCount = await prisma.order.count({
    where: { createdById: seedUser.id, status: 'REJECTED' },
  });
  if (rejectedCount === 0) {
    const candidate = await prisma.order.findFirst({
      where: {
        createdById: seedUser.id,
        status: 'CONFIRMED',
        deliveryDate: { lt: new Date(`${today}T00:00:00.000Z`) },
      },
      orderBy: { orderNumber: 'asc' },
    });
    if (candidate !== null) {
      const row = await prisma.order.findUniqueOrThrow({ where: { id: candidate.id }, select: { version: true } });
      await ordersLive.rejectOrder(candidate.id, seedUser.id, { version: row.version, reason: 'Kitchen short-staffed' });
    }
  }
  // Explicit future cancel: once ever, on an open date.
  const futureCancelled = await prisma.order.count({
    where: {
      createdById: seedUser.id,
      status: 'CANCELLED',
      deliveryDate: { gte: new Date(`${today}T00:00:00.000Z`) },
    },
  });
  if (futureCancelled === 0) {
    const id = await draft(sam.id, futureFar, [await bowl(sam.id, 1)]);
    const row = await prisma.order.findUniqueOrThrow({ where: { id }, select: { version: true } });
    await ordersLive.cancelOrder(id, seedUser.id, row.version, false);
  }

  // Deliver past drops (late, honestly: now is past their slot).
  // Drops move together; reviewer rows sharing a drop key hold it
  // back rather than fail it.
  const openPast = await prisma.order.findMany({
    where: {
      createdById: seedUser.id,
      status: 'CONFIRMED',
      invoiceId: null,
      deliveryDate: { lt: new Date(`${today}T00:00:00.000Z`) },
    },
    select: { id: true, companyId: true, addressId: true, deliveryDate: true, deliveryTimeMinute: true },
  });
  const drops = new Map<string, typeof openPast>();
  for (const row of openPast) {
    const key = `${row.companyId}|${row.addressId}|${toCalendarDate(row.deliveryDate)}|${row.deliveryTimeMinute}`;
    const list = drops.get(key) ?? [];
    list.push(row);
    drops.set(key, list);
  }
  for (const members of drops.values()) {
    const first = members[0];
    if (first === undefined) {
      continue;
    }
    const foreign = await prisma.order.count({
      where: {
        companyId: first.companyId,
        addressId: first.addressId,
        deliveryDate: first.deliveryDate,
        deliveryTimeMinute: first.deliveryTimeMinute,
        status: 'CONFIRMED',
        createdById: { not: seedUser.id },
      },
    });
    if (foreign > 0) {
      continue;
    }
    await finishDrop(
      prisma,
      kitchen,
      dispatch,
      members.map((row) => row.id),
      driver.id,
      seedUser.id,
      null,
    );
  }

  // Today: confirmed orders with kitchen stages + driver drops, when served.
  // All-or-nothing per date: fresh rows get staged; existing rows were
  // staged (or honestly settled) by the run that created them.
  // One company per staged order: same company + date + default time
  // would merge them into a single drop, and a drop cannot dispatch
  // while any member is still cooking.
  const ishaan = await prisma.employee
    .findUnique({ where: { email: 'ishaan.gupta@initech-labs.example' } })
    .catch(() => null);
  const initech = await prisma.company
    .findFirst({ where: { domains: { some: { domain: 'initech-labs.example' } } } })
    .catch(() => null);
  const todaySlots: Array<{ employeeId: string; role: 'started' | 'ready' | 'drop' }> = [];
  if (isCompanyDeliveryDay(acme.workingDays, acmeHolidays, today)) {
    todaySlots.push({ employeeId: riya.id, role: 'started' });
  }
  if (isCompanyDeliveryDay(globex.workingDays, [], today)) {
    todaySlots.push({ employeeId: sam.id, role: 'ready' });
  }
  if (
    initech !== null &&
    ishaan !== null &&
    isCompanyDeliveryDay(initech.workingDays, [], today)
  ) {
    todaySlots.push({ employeeId: ishaan.id, role: 'drop' });
  }
  if (todaySlots.length === 3 && !(await dateCovered(today))) {
    const istMinute = istMinutes(now);
    const minutes = {
      started: Math.max(60, istMinute - 240),
      ready: Math.min(1379, istMinute + 70),
      drop: Math.min(1379, istMinute + 300),
    };
    const stagedIds: Record<string, string> = {};
    for (const slot of todaySlots) {
      stagedIds[slot.role] = await placed(
        slot.employeeId,
        today,
        [await bowl(slot.employeeId, slot.role === 'drop' ? 1 : 2)],
        minutes[slot.role],
      );
    }
    await ordersLive.runCutoff(now);
    const ids = [stagedIds['started'], stagedIds['ready'], stagedIds['drop']];
    const staged = await confirmedOnly(
      prisma,
      ids.filter((id): id is string => id !== undefined),
    );
    if (staged.length < 3) {
      logAction(logger, 'seed.part-2.today-skipped', { reason: 'today-still-open' });
    } else {
      const startedId = stagedIds['started'];
      const readyId = stagedIds['ready'];
      const dropId = stagedIds['drop'];
      if (startedId !== undefined && readyId !== undefined && dropId !== undefined) {
        await startFirstUnit(prisma, kitchen, startedId, seedUser.id);
        await finishAllUnits(prisma, kitchen, readyId, seedUser.id);
        await finishDrop(prisma, kitchen, dispatch, [dropId], driver.id, seedUser.id, 'Left at reception');
      }
    }
  }

  // Invoices: unpaid from Acme delivered, paid from Globex delivered.
  const deliveredRows = await prisma.order.findMany({
    where: { createdById: seedUser.id, status: 'DELIVERED', invoiceId: null },
    select: { id: true, companyId: true },
    orderBy: { orderNumber: 'asc' },
  });
  const byCompany = new Map<string, string[]>();
  for (const row of deliveredRows) {
    const list = byCompany.get(row.companyId) ?? [];
    list.push(row.id);
    byCompany.set(row.companyId, list);
  }
  // Invoices: one unpaid + one paid maximum; leftovers stay billable.
  // Convergent: existing invoices satisfy the set, the delivered pool
  // only drains, so reruns add nothing.
  const existingUnpaid = await prisma.invoice.count({
    where: { paidAt: null, orders: { some: { createdById: seedUser.id } } },
  });
  const existingPaid = await prisma.invoice.count({
    where: { paidAt: { not: null }, orders: { some: { createdById: seedUser.id } } },
  });
  let invoices = 0;
  const acmeIds = byCompany.get(acme.id) ?? [];
  const globexIds = byCompany.get(globex.id) ?? [];
  if (existingUnpaid === 0 && acmeIds.length >= 2) {
    await billing.createInvoice(acme.id, acmeIds.slice(0, 2), admin.id);
    invoices += 1;
  }
  if (existingPaid === 0 && globexIds.length >= 2) {
    const invoice = await billing.createInvoice(globex.id, globexIds.slice(0, 2), admin.id);
    await billing.markPaid(invoice.id, admin.id);
    invoices += 1;
  }

  logAction(logger, 'seed.part-2.done', { orders: created, invoices });
  const skipped = created === 0 && invoices === 0;
  return { orders: created, invoices, skipped };
  }

  /** Inactive marker staff user owning all demo writes (D-77). */
  private async ensureMarkerUser(): Promise<{ id: string }> {
    const found = await this.prisma.staffUser.findUnique({ where: { email: SEED_EMAIL } });
    if (found !== null) {
      return { id: found.id };
    }
    const admin = await this.prisma.staffUser.findUnique({ where: { email: 'admin@test.com' } });
    const role = await this.prisma.role.findUniqueOrThrow({ where: { key: 'driver' } });
    const created = await this.staff.createStaff({
      name: 'Seed System',
      email: SEED_EMAIL,
      roleId: role.id,
      password: `seed-${Date.now()}-unused`,
    });
    await this.staff.setStaffActive(created.id, false, admin?.id ?? created.id);
    return created;
  }
}

/** Company defaults, plus a custom time only when the employee may change it. */
async function timedDetails(
  prisma: PrismaService,
  employeeId: string,
  timeMinute: number,
): Promise<{ addressId: string; deliveryTimeMinute: number; packagingTypeId: string }> {
  const employee = await prisma.employee.findUniqueOrThrow({
    where: { id: employeeId },
    select: {
      companyId: true,
      canChangeDeliveryTime: true,
      company: {
        select: {
          defaultDeliveryMinute: true,
          defaultPackagingTypeId: true,
          addresses: { where: { isActive: true }, select: { id: true, isDefault: true } },
        },
      },
    },
  });
  const fallback = employee.company.addresses[0];
  const preferred = employee.company.addresses.find((row) => row.isDefault) ?? fallback;
  if (preferred === undefined) {
    throw new Error('Seed company has no active address');
  }
  return {
    addressId: preferred.id,
    deliveryTimeMinute: employee.canChangeDeliveryTime ? timeMinute : employee.company.defaultDeliveryMinute,
    packagingTypeId: employee.company.defaultPackagingTypeId,
  };
}

/** Delivery-day dates strictly before today, newest first. */
function recentDeliveryDays(
  today: CalendarDate,
  workingDays: number[],
  holidays: CalendarDate[],
  count: number,
): CalendarDate[] {
  const out: CalendarDate[] = [];
  for (let back = 1; back <= 30 && out.length < count; back += 1) {
    const date = addDays(today, -back);
    if (isCompanyDeliveryDay(workingDays, holidays, date)) {
      out.push(date);
    }
  }
  return out;
}

/** Unlocked company-delivery dates strictly after today, nearest first. */
function upcomingOpenDates(
  today: CalendarDate,
  now: Date,
  cutoff: CutoffView,
  kitchenHolidays: CalendarDate[],
  workingDays: number[],
  holidays: CalendarDate[],
  count: number,
): CalendarDate[] {
  const out: CalendarDate[] = [];
  for (let forward = 1; forward <= 30 && out.length < count; forward += 1) {
    const date = addDays(today, forward);
    if (!isCompanyDeliveryDay(workingDays, holidays, date)) {
      continue;
    }
    if (now.getTime() >= cutoffInstant(date, cutoff, kitchenHolidays).getTime()) {
      continue;
    }
    out.push(date);
  }
  return out;
}

/** Minutes after midnight in the kitchen zone (no DST there). */
function istMinutes(now: Date): number {
  return (now.getUTCHours() * 60 + now.getUTCMinutes() + 330) % 1440;
}

function toCalendarDate(value: Date): CalendarDate {
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${value.getUTCFullYear()}-${month}-${day}`;
}

/** Full fulfilment chain for one confirmed order through the real services. */
/** Finish every member of one drop, then walk the drop once. */
async function finishDrop(
  prisma: PrismaService,
  kitchen: KitchenService,
  dispatch: DispatchService,
  orderIds: string[],
  driverId: string,
  actorId: string,
  note: string | null,
): Promise<void> {
  for (const orderId of orderIds) {
    await finishAllUnits(prisma, kitchen, orderId, actorId);
  }
  const first = orderIds[0];
  if (first === undefined) {
    return;
  }
  const row = await prisma.order.findUniqueOrThrow({
    where: { id: first },
    select: {
      companyId: true,
      addressId: true,
      deliveryDate: true,
      deliveryTimeMinute: true,
    },
  });
  const key = {
    companyId: row.companyId,
    addressId: row.addressId,
    deliveryDate: toCalendarDate(row.deliveryDate),
    deliveryTimeMinute: row.deliveryTimeMinute,
  };
  await dispatch.assignDriver(key, driverId, actorId);
  await dispatch.markDispatchReady(key, actorId);
  await dispatch.markOutForDelivery(key, actorId);
  await dispatch.markDelivered(key, driverId, note ?? undefined, undefined);
}

/** Keep only ids currently CONFIRMED (custom cut-off settings may hold rows open). */
async function confirmedOnly(prisma: PrismaService, ids: string[]): Promise<string[]> {
  const rows = await prisma.order.findMany({
    where: { id: { in: ids }, status: 'CONFIRMED' },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

/** Start exactly the first open unit (in-progress demo state). */
async function startFirstUnit(
  prisma: PrismaService,
  kitchen: KitchenService,
  orderId: string,
  actorId: string,
): Promise<void> {
  const unit = await prisma.orderLineCombination.findFirstOrThrow({
    where: { line: { orderId } },
    select: { id: true },
  });
  await kitchen.startUnit(unit.id, actorId);
}

/** Finish every open unit (kitchen-ready demo state). */
async function finishAllUnits(
  prisma: PrismaService,
  kitchen: KitchenService,
  orderId: string,
  actorId: string,
): Promise<void> {
  const units = await prisma.orderLineCombination.findMany({
    where: { line: { orderId }, doneAt: null },
    select: { id: true },
  });
  for (const unit of units) {
    await kitchen.doneUnit(unit.id, actorId);
  }
}
