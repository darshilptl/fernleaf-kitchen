import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service.js';
import { requireTestDatabaseUrl, truncateAll, createTestCompany } from '../../../test/db.js';
import { ensureBaseData } from '../auth/base-data.js';
import { CatalogueService } from '../catalogue/catalogue.service.js';
import { CompaniesService } from '../companies/companies.service.js';
import { EmployeesService } from '../employees/employees.service.js';
import { MenuService } from '../menu/menu.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import { ClockService } from '../../common/clock/clock.service.js';
import { OrdersService } from './orders.service.js';

/**
 * Orders end to end on the real test database. PDF §4.6.
 * Fixtures go through the real services (never raw inserts)
 * so totals stay reconcilable; time is a frozen fake clock.
 * 2026-10-05 is a Monday; delivery Fridays lock Wednesday 16:00.
 */

const NOW = new Date('2026-10-05T09:00:00.000Z');
const FRIDAY = '2026-10-09';

interface Fixture {
  companyId: string;
  employeeId: string;
  dishId: string;
  optionA: string;
  optionB: string;
  actorId: string;
}

describe('OrdersService', () => {
  const prisma = new PrismaService(requireTestDatabaseUrl());
  const clock = new ClockService();
  const pricing = new PricingService(prisma);
  const orders = new OrdersService(prisma, pricing, clock);

  beforeEach(async () => {
    await truncateAll(prisma);
    await ensureBaseData(prisma);
    clock.setNow(NOW);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function setup(dishOverrides?: { minOrderQuantity?: number | null }): Promise<Fixture> {
    const catalogue = new CatalogueService(prisma);
    const employees = new EmployeesService(prisma);
    const menu = new MenuService(prisma, pricing);
    const { id: companyId } = await createTestCompany(prisma);
    const employee = await employees.createEmployee(companyId, {
      name: 'Kim Order',
      email: `kim.${Date.now()}.${Math.floor(Math.random() * 100000)}@acme.test`,
    });
    const optionA = await catalogue.createOption({ name: 'Rice A', costCents: 40 });
    const optionB = await catalogue.createOption({ name: 'Rice B', costCents: 50 });
    const dish = await catalogue.createDish({
      name: 'Bowl',
      sku: `BWL-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      temperature: 'HOT',
      costCents: 310,
      minOrderQuantity: dishOverrides?.minOrderQuantity ?? null,
    });
    const group = await catalogue.createGroup(
      dish.id,
      {},
      { name: 'Choose rice', isRequired: true, sortOrder: 0 },
    );
    await catalogue.attachOption(group.id, { optionId: optionA.id, sortOrder: 0 });
    await catalogue.attachOption(group.id, { optionId: optionB.id, sortOrder: 1 });
    const tier = await pricing.createTier({ name: 'Standard' });
    await pricing.saveBatchPrices(tier.id, {
      dishPrices: [{ itemId: dish.id, priceCents: 700 }],
      optionPrices: [
        { itemId: optionA.id, priceCents: 0 },
        { itemId: optionB.id, priceCents: 50 },
      ],
    });
    const category = await menu.createCategory({ name: 'Bowls' });
    await menu.addPlacement(category.id, { dishId: dish.id });
    const actor = await prisma.staffUser.findUniqueOrThrow({ where: { email: 'admin@test.com' } });
    return {
      companyId,
      employeeId: employee.id,
      dishId: dish.id,
      optionA: optionA.id,
      optionB: optionB.id,
      actorId: actor.id,
    };
  }

  function line(dishId: string, optionId: string, quantity = 2): {
    dishId: string;
    combinations: Array<{ quantity: number; choices: Array<{ optionId: string }> }>;
  } {
    return {
      dishId,
      combinations: [{ quantity, choices: [{ optionId }] },
      ],
    };
  }

  it('creates an empty draft, then lines, then places with snapshot totals', async () => {
    const fx = await setup();
    const created = await orders.createOrder(fx.actorId, {
      employeeId: fx.employeeId,
      deliveryDate: FRIDAY,
    });
    expect(created.orderNumber).toBeGreaterThan(0);
    await orders.updateOrder(created.id, fx.actorId, {
      version: 0,
      lines: [line(fx.dishId, fx.optionA)],
    });
    const placed = await orders.placeOrder(created.id, fx.actorId, 1);
    expect(placed.version).toBe(2);
    const detail = (await orders.getOrder(created.id)) as {
      status: string;
      totalCents: number;
      lines: Array<{ dishName: string; dishPriceCents: number; lineTotalCents: number }>;
    };
    expect(detail.status).toBe('PLACED');
    expect(detail.totalCents).toBe(1400);
    expect(detail.lines[0]).toMatchObject({ dishName: 'Bowl', dishPriceCents: 700, lineTotalCents: 1400 });
  });

  it('rejects a new order after the cut-off for everyone', async () => {
    const fx = await setup();
    clock.setNow(new Date('2026-10-07T11:00:00.000Z'));
    await expect(
      orders.createOrder(fx.actorId, {
        employeeId: fx.employeeId,
        deliveryDate: FRIDAY,
        lines: [line(fx.dishId, fx.optionA)],
      }),
    ).rejects.toMatchObject({ code: 'ORDER_LOCKED' });
  });

  it('rejects a past delivery date', async () => {
    const fx = await setup();
    await expect(
      orders.createOrder(fx.actorId, {
        employeeId: fx.employeeId,
        deliveryDate: '2026-10-04',
        lines: [line(fx.dishId, fx.optionA)],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', path: 'deliveryDate' });
  });

  it('rejects a company non-delivery day', async () => {
    const fx = await setup();
    const companies = new CompaniesService(prisma);
    await companies.addHoliday(fx.companyId, { date: FRIDAY, name: 'Day off' });
    await expect(
      orders.createOrder(fx.actorId, {
        employeeId: fx.employeeId,
        deliveryDate: FRIDAY,
        lines: [line(fx.dishId, fx.optionA)],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', path: 'deliveryDate' });
  });

  it('binds employee flags to every order before the cut-off', async () => {
    const fx = await setup();
    const extra = await prisma.companyAddress.create({
      data: {
        companyId: fx.companyId,
        label: 'Annex',
        line1: '2 Side St',
        city: 'Mumbai',
        postalCode: '400002',
        country: 'IN',
        isDefault: false,
      },
      select: { id: true },
    });
    const packaging = await prisma.packagingType.findFirstOrThrow({ select: { id: true } });
    await expect(
      orders.createOrder(fx.actorId, {
        employeeId: fx.employeeId,
        deliveryDate: FRIDAY,
        details: {
          addressId: extra.id,
          deliveryTimeMinute: 720,
          packagingTypeId: packaging.id,
        },
        lines: [line(fx.dishId, fx.optionA)],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', path: 'details.addressId' });
  });

  it('rejects a repeated dish and a duplicate combination', async () => {
    const fx = await setup();
    const lines = [
      line(fx.dishId, fx.optionA),
      line(fx.dishId, fx.optionB),
    ];
    await expect(
      orders.createOrder(fx.actorId, { employeeId: fx.employeeId, deliveryDate: FRIDAY, lines }),
    ).rejects.toMatchObject({ path: 'lines[1].dishId' });
    const dupCombo = {
      dishId: fx.dishId,
      combinations: [
        { quantity: 1, choices: [{ optionId: fx.optionA }] },
        { quantity: 1, choices: [{ optionId: fx.optionA }] },
      ],
    };
    await expect(
      orders.createOrder(fx.actorId, { employeeId: fx.employeeId, deliveryDate: FRIDAY, lines: [dupCombo] }),
    ).rejects.toMatchObject({ path: 'lines[0].combinations[1]' });
  });

  it('enforces the dish minimum across combinations', async () => {
    const fx = await setup({ minOrderQuantity: 5 });
    await expect(
      orders.createOrder(fx.actorId, {
        employeeId: fx.employeeId,
        deliveryDate: FRIDAY,
        lines: [line(fx.dishId, fx.optionA, 2)],
      }),
    ).rejects.toMatchObject({ path: 'lines[0].quantity' });
  });

  it('requires exactly one option per required group', async () => {
    const fx = await setup();
    const empty = { dishId: fx.dishId, combinations: [{ quantity: 1, choices: [] }] };
    await expect(
      orders.createOrder(fx.actorId, { employeeId: fx.employeeId, deliveryDate: FRIDAY, lines: [empty] }),
    ).rejects.toMatchObject({ path: 'lines[0].combinations[0].choices' });
    const two = {
      dishId: fx.dishId,
      combinations: [{ quantity: 2, choices: [{ optionId: fx.optionA }, { optionId: fx.optionB }] }],
    };
    await expect(
      orders.createOrder(fx.actorId, { employeeId: fx.employeeId, deliveryDate: FRIDAY, lines: [two] }),
    ).rejects.toMatchObject({ path: 'lines[0].combinations[0].choices' });
  });

  it('rejects an unpriced option as unselectable', async () => {
    const fx = await setup();
    const catalogue = new CatalogueService(prisma);
    const extra = await catalogue.createOption({ name: 'Extra', costCents: 10 });
    const group = await prisma.optionGroup.findFirstOrThrow({ select: { id: true } });
    await catalogue.attachOption(group.id, { optionId: extra.id, sortOrder: 2 });
    await expect(
      orders.createOrder(fx.actorId, {
        employeeId: fx.employeeId,
        deliveryDate: FRIDAY,
        lines: [line(fx.dishId, extra.id)],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('keeps stored lines on a details-only edit', async () => {
    const fx = await setup();
    const created = await orders.createOrder(fx.actorId, {
      employeeId: fx.employeeId,
      deliveryDate: FRIDAY,
      lines: [line(fx.dishId, fx.optionA)],
    });
    const packaging = await prisma.packagingType.findFirstOrThrow({ select: { id: true } });
    const updated = await orders.updateOrder(created.id, fx.actorId, {
      version: 0,
      details: {
        addressId: (await prisma.companyAddress.findFirstOrThrow({ where: { companyId: fx.companyId } })).id,
        deliveryTimeMinute: 720,
        packagingTypeId: packaging.id,
      },
    });
    expect(updated.version).toBe(1);
    const detail = (await orders.getOrder(created.id)) as { totalCents: number; lines: unknown[] };
    expect(detail.totalCents).toBe(1400);
    expect(detail.lines).toHaveLength(1);
  });

  it('fails placing when the dish became unavailable', async () => {
    const fx = await setup();
    const catalogue = new CatalogueService(prisma);
    const created = await orders.createOrder(fx.actorId, {
      employeeId: fx.employeeId,
      deliveryDate: FRIDAY,
      lines: [line(fx.dishId, fx.optionA)],
    });
    await catalogue.setDishActive(fx.dishId, false);
    await expect(orders.placeOrder(created.id, fx.actorId, 0)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('freezes snapshots while edits reprice the whole order', async () => {
    const fx = await setup();
    const created = await orders.createOrder(fx.actorId, {
      employeeId: fx.employeeId,
      deliveryDate: FRIDAY,
      lines: [line(fx.dishId, fx.optionA)],
    });
    const tier = await prisma.priceTier.findFirstOrThrow({ select: { id: true } });
    await pricing.saveBatchPrices(tier.id, {
      dishPrices: [{ itemId: fx.dishId, priceCents: 800 }],
      optionPrices: [],
    });
    const before = (await orders.getOrder(created.id)) as { totalCents: number };
    expect(before.totalCents).toBe(1400);
    await orders.updateOrder(created.id, fx.actorId, {
      version: 0,
      lines: [line(fx.dishId, fx.optionA)],
    });
    const after = (await orders.getOrder(created.id)) as { totalCents: number };
    expect(after.totalCents).toBe(1600);
  });

  it('blocks a locked edit even before the cut-off job ran', async () => {
    const fx = await setup();
    const created = await orders.createOrder(fx.actorId, {
      employeeId: fx.employeeId,
      deliveryDate: FRIDAY,
      lines: [line(fx.dishId, fx.optionA)],
    });
    clock.setNow(new Date('2026-10-07T11:00:00.000Z'));
    await expect(
      orders.updateOrder(created.id, fx.actorId, { version: 0, lines: [line(fx.dishId, fx.optionB)] }),
    ).rejects.toMatchObject({ code: 'ORDER_LOCKED' });
  });

  it('runs cut-off twice with the same result and no duplicate events', async () => {
    const fx = await setup();
    // Repeats of a dish are per order (D-54): two orders may share it.
    const draft = await orders.createOrder(fx.actorId, {
      employeeId: fx.employeeId,
      deliveryDate: FRIDAY,
      lines: [line(fx.dishId, fx.optionA)],
    });
    const other = await orders.createOrder(fx.actorId, {
      employeeId: fx.employeeId,
      deliveryDate: FRIDAY,
      lines: [line(fx.dishId, fx.optionA, 1)],
    });
    await orders.placeOrder(other.id, fx.actorId, 0);
    clock.setNow(new Date('2026-10-07T11:00:00.000Z'));
    const first = await orders.runCutoff(clock.now());
    expect(first).toMatchObject({ cancelled: 1, confirmed: 1 });
    const second = await orders.runCutoff(clock.now());
    expect(second).toMatchObject({ cancelled: 0, confirmed: 0 });
    const events = await prisma.orderEvent.count();
    expect(events).toBe(5);
    const draftRow = await prisma.order.findUniqueOrThrow({ where: { id: draft.id } });
    const otherRow = await prisma.order.findUniqueOrThrow({ where: { id: other.id } });
    expect(draftRow.status).toBe('CANCELLED');
    expect(otherRow.status).toBe('CONFIRMED');
  });

  it('survives two parallel cut-off runs without duplicate events', async () => {
    const fx = await setup();
    const placed = await orders.createOrder(fx.actorId, {
      employeeId: fx.employeeId,
      deliveryDate: FRIDAY,
      lines: [line(fx.dishId, fx.optionA)],
    });
    await orders.placeOrder(placed.id, fx.actorId, 0);
    clock.setNow(new Date('2026-10-07T11:00:00.000Z'));
    const results = await Promise.allSettled([orders.runCutoff(clock.now()), orders.runCutoff(clock.now())]);
    expect(results.every((row) => row.status === 'fulfilled')).toBe(true);
    const events = await prisma.orderEvent.count({
      where: { orderId: placed.id, type: 'CONFIRMED' },
    });
    expect(events).toBe(1);
  });

  it('fails one of two simultaneous edits with a version conflict', async () => {
    const fx = await setup();
    const created = await orders.createOrder(fx.actorId, {
      employeeId: fx.employeeId,
      deliveryDate: FRIDAY,
      lines: [line(fx.dishId, fx.optionA)],
    });
    const results = await Promise.allSettled([
      orders.updateOrder(created.id, fx.actorId, { version: 0, lines: [line(fx.dishId, fx.optionA)] }),
      orders.updateOrder(created.id, fx.actorId, { version: 0, lines: [line(fx.dishId, fx.optionB)] }),
    ]);
    const fulfilled = results.filter((row) => row.status === 'fulfilled');
    const rejected = results.filter((row) => row.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: 'ORDER_STATE_CONFLICT',
    });
  });

  it('cancels and rejects through overrides, never when invoiced', async () => {
    const fx = await setup();
    const placed = await orders.createOrder(fx.actorId, {
      employeeId: fx.employeeId,
      deliveryDate: FRIDAY,
      lines: [line(fx.dishId, fx.optionA)],
    });
    await orders.placeOrder(placed.id, fx.actorId, 0);
    await orders.rejectOrder(placed.id, fx.actorId, { version: 1, reason: 'Kitchen closed' });
    const rejected = await prisma.order.findUniqueOrThrow({ where: { id: placed.id } });
    expect(rejected.status).toBe('REJECTED');
    // Invoiced orders cannot move again: link an invoice directly.
    const invoice = await prisma.invoice.create({
      data: { companyId: fx.companyId, createdById: fx.actorId, totalCents: 1400 },
    });
    const second = await orders.createOrder(fx.actorId, {
      employeeId: fx.employeeId,
      deliveryDate: FRIDAY,
      lines: [line(fx.dishId, fx.optionA, 1)],
    });
    await orders.placeOrder(second.id, fx.actorId, 0);
    await prisma.order.update({ where: { id: second.id }, data: { invoiceId: invoice.id } });
    await expect(
      orders.cancelOrder(second.id, fx.actorId, 1, true),
    ).rejects.toMatchObject({ code: 'ORDER_INVOICED' });
    await expect(
      orders.rejectOrder(second.id, fx.actorId, { version: 1, reason: 'No' }),
    ).rejects.toMatchObject({ code: 'ORDER_INVOICED' });
  });

  it('overrides details with driver rules after the cut-off', async () => {
    const fx = await setup();
    const created = await orders.createOrder(fx.actorId, {
      employeeId: fx.employeeId,
      deliveryDate: FRIDAY,
      lines: [line(fx.dishId, fx.optionA)],
    });
    await orders.placeOrder(created.id, fx.actorId, 0);
    const packaging = await prisma.packagingType.findFirstOrThrow({ select: { id: true } });
    const eco = await prisma.packagingType.create({ data: { name: 'Eco' }, select: { id: true } });
    const moved = await orders.overrideDetails(created.id, fx.actorId, {
      version: 1,
      deliveryTimeMinute: 780,
      packagingTypeId: eco.id,
    });
    expect(moved.version).toBe(2);
    // Once dispatch is ready, time and address freeze; packaging stays open.
    // The fulfilment chain check needs kitchenReadyAt before dispatch.
    await prisma.order.update({
      where: { id: created.id },
      data: { kitchenStartedAt: new Date(), kitchenReadyAt: new Date(), dispatchReadyAt: new Date(), driverId: fx.actorId },
    });
    await expect(
      orders.overrideDetails(created.id, fx.actorId, { version: 2, deliveryTimeMinute: 800 }),
    ).rejects.toMatchObject({ code: 'ORDER_STATE_CONFLICT' });
    const kept = await orders.overrideDetails(created.id, fx.actorId, {
      version: 2,
      packagingTypeId: packaging.id,
    });
    expect(kept.version).toBe(3);
  });

  it('blocks an employee move while open orders exist', async () => {
    const fx = await setup();
    const employees = new EmployeesService(prisma);
    await orders.createOrder(fx.actorId, {
      employeeId: fx.employeeId,
      deliveryDate: FRIDAY,
      lines: [line(fx.dishId, fx.optionA)],
    });
    const other = await createTestCompany(prisma, {
      name: 'Other Co',
      domains: ['other.test'],
      ownerName: 'Olivia Owner',
      ownerEmail: 'olivia@other.test',
      packagingName: 'Crate',
    });
    await expect(
      employees.updateEmployee(fx.employeeId, { companyId: other.id }),
    ).rejects.toMatchObject({ code: 'EMPLOYEE_MOVE_BLOCKED' });
  });

  it('lists with filters, search and pagination', async () => {
    const fx = await setup();
    await orders.createOrder(fx.actorId, {
      employeeId: fx.employeeId,
      deliveryDate: FRIDAY,
      lines: [line(fx.dishId, fx.optionA)],
    });
    const page = await orders.listOrders({
      page: 1,
      pageSize: 20,
      search: 'acme',
      status: 'DRAFT',
      companyId: fx.companyId,
      invoiced: false,
      from: FRIDAY,
      to: FRIDAY,
    });
    expect(page.total).toBe(1);
    expect(page.items).toHaveLength(1);
    const empty = await orders.listOrders({ page: 1, pageSize: 20, search: 'zzz-no-match' });
    expect(empty.total).toBe(0);
  });
});
