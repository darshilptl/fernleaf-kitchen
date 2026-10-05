import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { addDays, cutoffInstant, isCompanyDeliveryDay, kitchenToday } from '@repo/shared';
import type { CalendarDate } from '@repo/shared';
import { PrismaService } from '../../database/prisma.service.js';
import { requireTestDatabaseUrl, truncateAll, createTestCompany } from '../../../test/db.js';
import { ensureBaseData } from '../auth/base-data.js';
import { BillingService } from '../billing/billing.service.js';
import { CatalogueService } from '../catalogue/catalogue.service.js';
import { ClockService } from '../../common/clock/clock.service.js';
import { EmployeesService } from '../employees/employees.service.js';
import { MenuService } from '../menu/menu.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import { DashboardsService } from './dashboards.service.js';

/**
 * Admin figures. PDF §4.11 / skill dashboards (A1-A4).
 * Live dates (never fixed): future open dates scan forward for
 * an unlocked company delivery day under the live settings.
 */
describe('DashboardsService', () => {
  const prisma = new PrismaService(requireTestDatabaseUrl());
  const clock = new ClockService();
  const pricing = new PricingService(prisma);
  const dashboards = new DashboardsService(prisma, pricing, clock);
  const billing = new BillingService(prisma, clock);

  beforeEach(async () => {
    await truncateAll(prisma);
    await ensureBaseData(prisma);
    clock.setNow(new Date());
  }, 300000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('reports status spread, unbilled, unpaid age and pricing gaps', async () => {
    const catalogue = new CatalogueService(prisma);
    const employees = new EmployeesService(prisma);
    const menu = new MenuService(prisma, pricing);
    const orders = new OrdersService(prisma, pricing, clock);
    const { id: companyId } = await createTestCompany(prisma);
    const employee = await employees.createEmployee(companyId, {
      name: 'Dash Kim',
      email: `dash.${Date.now()}@acme.test`,
    });
    const option = await catalogue.createOption({ name: 'Rice', costCents: 40 });
    const dish = await catalogue.createDish({
      name: 'Bowl',
      sku: `DSH-${Date.now()}`,
      temperature: 'HOT',
      costCents: 300,
    });
    const group = await catalogue.createGroup(dish.id, {}, { name: 'Rice', isRequired: true, sortOrder: 0 });
    await catalogue.attachOption(group.id, { optionId: option.id, sortOrder: 0 });
    const tier = await pricing.createTier({ name: 'Standard' });
    await pricing.saveBatchPrices(tier.id, {
      dishPrices: [{ itemId: dish.id, priceCents: 700 }],
      optionPrices: [{ itemId: option.id, priceCents: 0 }],
    });
    const category = await menu.createCategory({ name: 'Bowls' });
    await menu.addPlacement(category.id, { dishId: dish.id });
    const actor = await prisma.staffUser.findUniqueOrThrow({ where: { email: 'admin@test.com' } });

    const today = kitchenToday(clock.now());
    const liveSettings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: 1 } });
    const kitchenHolidays = (
      await prisma.kitchenHoliday.findMany({ select: { date: true } })
    ).map((row) => toCalendarDate(row.date));
    const cutoffView = {
      kitchenWorkingDays: liveSettings.kitchenWorkingDays,
      cutoffTimeMinute: liveSettings.cutoffTimeMinute,
      cutoffWorkingDays: liveSettings.cutoffWorkingDays,
    };
    const acmeHolidays = (
      await prisma.companyHoliday.findMany({
        where: { company: { domains: { some: { domain: 'acme-foods.example' } } } },
        select: { date: true },
      })
    ).map((row) => toCalendarDate(row.date));
    const future = scanOpen(today, clock.now(), cutoffView, kitchenHolidays, [1, 2, 3, 4, 5], acmeHolidays);
    const line = {
      dishId: dish.id,
      combinations: [{ quantity: 2, choices: [{ optionId: option.id }] }],
    };
    const draft = await orders.createOrder(actor.id, { employeeId: employee.id, deliveryDate: future, lines: [line] });
    const placed = await orders.createOrder(actor.id, { employeeId: employee.id, deliveryDate: future, lines: [line] });
    const placedRow = await prisma.order.findUniqueOrThrow({ where: { id: placed.id }, select: { version: true } });
    await orders.placeOrder(placed.id, actor.id, placedRow.version);
    void draft;

    const figures = await dashboards.adminFigures();
    const byStatus = new Map(figures.byStatus.map((row) => [row.status, row.count]));
    expect(byStatus.get('DRAFT') ?? 0).toBeGreaterThanOrEqual(1);
    expect(byStatus.get('PLACED') ?? 0).toBeGreaterThanOrEqual(1);
    expect(figures.byStatus).toHaveLength(6);
    expect(figures.unbilledTotalCents).toBe(0);
    expect(figures.topCompanies).toHaveLength(0);
    expect(figures.unpaidCount).toBe(0);
    expect(figures.oldestUnpaidAgeDays).toBeNull();

    // Confirm honestly through cut-off processing with a future clock.
    await orders.runCutoff(new Date(clock.now().getTime() + 30 * 24 * 60 * 60 * 1000));
    const confirmed = await prisma.order.findMany({
      where: { status: 'CONFIRMED' },
      select: { id: true },
    });
    expect(confirmed.length).toBeGreaterThan(0);
    const billable = await billing.billable(companyId);
    expect((billable as Array<unknown>).length).toBeGreaterThan(0);
    const invoice = await billing.createInvoice(
      companyId,
      confirmed.map((row) => row.id),
      actor.id,
    );
    void invoice;
    const again = await dashboards.adminFigures();
    expect(again.unpaidCount).toBe(1);
    expect(again.oldestUnpaidAgeDays).toBe(0);
    expect(again.unbilledTotalCents).toBe(0);

    const gapDish = await catalogue.createDish({
      name: 'Priceless',
      sku: `GAP-${Date.now()}`,
      temperature: 'COLD',
      costCents: 100,
    });
    void gapDish;
    const gapped = await dashboards.adminFigures();
    expect(gapped.pricingGapDishes).toBe(1);
  }, 600000);

  function toCalendarDate(value: Date): CalendarDate {
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${value.getUTCFullYear()}-${month}-${day}`;
  }

  /** First unlocked company delivery day after today (live settings). */
  function scanOpen(
    today: string,
    now: Date,
    cutoff: { kitchenWorkingDays: number[]; cutoffTimeMinute: number; cutoffWorkingDays: number },
    kitchenHolidays: CalendarDate[],
    workingDays: number[],
    holidays: CalendarDate[],
  ): string {
    for (let forward = 1; forward <= 30; forward += 1) {
      const date = addDays(today, forward);
      if (!isCompanyDeliveryDay(workingDays, holidays, date)) {
        continue;
      }
      if (now.getTime() >= cutoffInstant(date, cutoff, kitchenHolidays).getTime()) {
        continue;
      }
      return date;
    }
    throw new Error('No open delivery date found');
  }
});
