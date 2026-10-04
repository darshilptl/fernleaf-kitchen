import { Logger } from '@nestjs/common';
import {
  addDays,
  cutoffInstant,
  isCompanyDeliveryDay,
  kitchenToday,
} from '@repo/shared';
import type { CalendarDate } from '@repo/shared';
import type { PrismaService } from '../../src/database/prisma.service.js';
import { BillingService } from '../../src/modules/billing/billing.service.js';
import { ClockService } from '../../src/common/clock/clock.service.js';
import { DispatchService } from '../../src/modules/dispatch/dispatch.service.js';
import { KitchenService } from '../../src/modules/kitchen/kitchen.service.js';
import { OrdersService } from '../../src/modules/orders/orders.service.js';
import { PricingService } from '../../src/modules/pricing/pricing.service.js';
import { StaffService } from '../../src/modules/staff/staff.service.js';
import { logAction } from '../../src/common/logging/logging.interceptor.js';

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
 * Custom delivery times appear only on the one employee holding
 * `canChangeDeliveryTime` (D-59); everyone else takes defaults.
 *
 * Algorithm:
 *   1. Ensure the marker user (inactive) + pick date-relative targets.
 *   2. With a backdated clock, create drafts/placed everywhere open.
 *   3. `runCutoff(realNow)`: past/today targets settle honestly.
 *   4. Explicit reject/cancel + kitchen/dispatch/deliver steps +
 *      invoices through the real services.
 * Invariants: a second run on overlapping dates creates zero rows
 * (seed orders already cover today and the future); reviewer rows
 * (other creators) are never gated on, never written.
 * Edge cases: no company serves today (e.g. Sunday) skips the
 * today section; reviewer-edited cut-off settings shift targets
 * through the same live computation reviewers get.
 */

const SEED_EMAIL = 'seed@fernleaf.test';
const logger = new Logger('seed-part-2');

export interface SeedPart2Counts {
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

export async function seedPart2(prisma: PrismaService, now: Date = new Date()): Promise<SeedPart2Counts> {
  const today = kitchenToday(now);
  const seedUser = await ensureMarkerUser(prisma);
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

  // Idempotency: today and the future already hold seed orders.
  const existing = await prisma.order.count({
    where: {
      createdById: seedUser.id,
      deliveryDate: { gte: new Date(`${today}T00:00:00.000Z`) },
    },
  });
  if (existing > 0) {
    return { orders: 0, invoices: 0, skipped: true };
  }

  const backdated = new ClockService();
  backdated.setNow(new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000));
  const live = new ClockService();
  live.setNow(now);
  const pricing = new PricingService(prisma);
  const ordersBackdated = new OrdersService(prisma, pricing, backdated);
  const ordersLive = new OrdersService(prisma, pricing, live);
  const kitchen = new KitchenService(prisma, live);
  const dispatch = new DispatchService(prisma, live);
  const billing = new BillingService(prisma, live);
  const admin = await prisma.staffUser.findUniqueOrThrow({ where: { email: 'admin@test.com' } });
  const driver = await prisma.staffUser.findUniqueOrThrow({ where: { email: 'driver@test.com' } });

  const riya = await prisma.employee.findUniqueOrThrow({ where: { email: 'riya.shah@acme-foods.example' } });
  const karan = await prisma.employee.findUniqueOrThrow({ where: { email: 'karan.mehta@acme-foods.example' } });
  const sam = await prisma.employee.findUniqueOrThrow({ where: { email: 'sam.dsouza@globex-logistics.example' } });
  const bwl102 = await prisma.dish.findUniqueOrThrow({ where: { sku: 'BWL-102' } });
  const brk201 = await prisma.dish.findUniqueOrThrow({ where: { sku: 'BRK-201' } });
  const dst302 = await prisma.dish.findUniqueOrThrow({ where: { sku: 'DST-302' } });
  const brownRice = await prisma.option.findFirstOrThrow({ where: { name: 'Brown rice' } });

  const bowl = (dishId: string, quantity: number): SeedLine => ({
    dishId,
    combinations: [{ quantity, choices: [{ optionId: brownRice.id }] }],
  });
  const plain = (dishId: string, quantity: number): SeedLine => ({
    dishId,
    combinations: [{ quantity, choices: [] }],
  });

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
  const acmeDeliveredA = await placed(riya.id, acmePastFar, [bowl(bwl102.id, 2)]);
  const acmeDeliveredB = await placed(karan.id, acmePastFar, [plain(brk201.id, 2)]);
  await draft(riya.id, acmePastFar, [plain(brk201.id, 1)]);
  const acmeReject = await placed(karan.id, acmePastNear, [bowl(bwl102.id, 1)]);
  // Past Globex: two delivered (paid invoice below).
  const globexDeliveredA = await placed(sam.id, globexPastDay, [bowl(bwl102.id, 1)]);
  const globexDeliveredB = await placed(sam.id, globexPastDay, [plain(brk201.id, 3)]);
  // Future Acme: open placed + one draft cancelled explicitly below.
  await placed(riya.id, futureNear, [bowl(bwl102.id, 2)]);
  await placed(karan.id, futureFar, [plain(dst302.id, 3)]);
  const futureCancel = await draft(sam.id, futureFar, [plain(brk201.id, 1)]);

  // Settle past targets honestly through cut-off processing.
  await ordersLive.runCutoff(now);

  const settledReject = await prisma.order.findUniqueOrThrow({ where: { id: acmeReject }, select: { version: true } });
  await ordersLive.rejectOrder(acmeReject, seedUser.id, { version: settledReject.version, reason: 'Kitchen short-staffed' });
  const settledDraft = await prisma.order.findUniqueOrThrow({ where: { id: futureCancel }, select: { version: true } });
  await ordersLive.cancelOrder(futureCancel, seedUser.id, settledDraft.version, false);

  // Deliver the past chains (late, honestly: now is past their slot).
  // Reviewer-edited cut-off settings can leave rows open; only walk
  // chains that actually reached CONFIRMED.
  const deliverable = await confirmedOnly(prisma, [acmeDeliveredA, acmeDeliveredB, globexDeliveredA, globexDeliveredB]);
  for (const id of deliverable) {
    await finishChain(prisma, kitchen, dispatch, id, driver.id, seedUser.id);
  }

  // Today: confirmed orders with kitchen stages + driver drops, when served.
  if (isCompanyDeliveryDay(acme.workingDays, acmeHolidays, today)) {
    const istMinute = istMinutes(now);
    const startedId = await placed(riya.id, today, [bowl(bwl102.id, 2)], Math.max(60, istMinute - 240));
    const readyId = await placed(riya.id, today, [plain(brk201.id, 2)], Math.min(1379, istMinute + 70));
    const dropId = await placed(riya.id, today, [plain(dst302.id, 1)], Math.min(1379, istMinute + 300));
    await ordersLive.runCutoff(now);
    const staged = await confirmedOnly(prisma, [startedId, readyId, dropId]);
    if (staged.length < 3) {
      logAction(logger, 'seed.part-2.today-skipped', { reason: 'today-still-open' });
    } else {
      await startFirstUnit(prisma, kitchen, startedId, seedUser.id);
      await finishAllUnits(prisma, kitchen, readyId, seedUser.id);
      await finishAllUnits(prisma, kitchen, dropId, seedUser.id);
      const dropRow = await prisma.order.findUniqueOrThrow({
        where: { id: dropId },
        select: { companyId: true, addressId: true, deliveryTimeMinute: true },
      });
      const key = {
        companyId: dropRow.companyId,
        addressId: dropRow.addressId,
        deliveryDate: today,
        deliveryTimeMinute: dropRow.deliveryTimeMinute,
      };
      await dispatch.assignDriver(key, driver.id, seedUser.id);
      await dispatch.markDispatchReady(key, seedUser.id);
      await dispatch.markOutForDelivery(key, seedUser.id);
      await dispatch.markDelivered(key, driver.id, 'Left at reception', undefined);
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
  let invoices = 0;
  const acmeIds = byCompany.get(acme.id) ?? [];
  const globexIds = byCompany.get(globex.id) ?? [];
  if (acmeIds.length >= 2) {
    await billing.createInvoice(acme.id, acmeIds.slice(0, 2), admin.id);
    invoices += 1;
  }
  if (globexIds.length >= 2) {
    const invoice = await billing.createInvoice(globex.id, globexIds.slice(0, 2), admin.id);
    await billing.markPaid(invoice.id, admin.id);
    invoices += 1;
  }

  logAction(logger, 'seed.part-2.done', { orders: created, invoices });
  return { orders: created, invoices, skipped: false };
}

/** Inactive marker staff user owning all demo writes (D-77). */
async function ensureMarkerUser(prisma: PrismaService): Promise<{ id: string }> {
  const found = await prisma.staffUser.findUnique({ where: { email: SEED_EMAIL } });
  if (found !== null) {
    return { id: found.id };
  }
  const admin = await prisma.staffUser.findUnique({ where: { email: 'admin@test.com' } });
  const staff = new StaffService(prisma);
  const role = await prisma.role.findUniqueOrThrow({ where: { key: 'driver' } });
  const created = await staff.createStaff({
    name: 'Seed System',
    email: SEED_EMAIL,
    roleId: role.id,
    password: `seed-${Date.now()}-unused`,
  });
  await staff.setStaffActive(created.id, false, admin?.id ?? created.id);
  return created;
}

/** Company defaults plus an allowed custom time (Riya holds the flag). */
async function timedDetails(
  prisma: PrismaService,
  employeeId: string,
  timeMinute: number,
): Promise<{ addressId: string; deliveryTimeMinute: number; packagingTypeId: string }> {
  const employee = await prisma.employee.findUniqueOrThrow({
    where: { id: employeeId },
    select: {
      companyId: true,
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
    deliveryTimeMinute: timeMinute,
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
async function finishChain(
  prisma: PrismaService,
  kitchen: KitchenService,
  dispatch: DispatchService,
  orderId: string,
  driverId: string,
  actorId: string,
): Promise<void> {
  await finishAllUnits(prisma, kitchen, orderId, actorId);
  const row = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
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
  await dispatch.markDelivered(key, driverId, undefined, undefined);
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
