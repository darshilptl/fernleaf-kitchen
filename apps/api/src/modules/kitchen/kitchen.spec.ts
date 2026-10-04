import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service.js';
import { requireTestDatabaseUrl, truncateAll, createTestCompany } from '../../../test/db.js';
import { ensureBaseData } from '../auth/base-data.js';
import { CatalogueService } from '../catalogue/catalogue.service.js';
import { EmployeesService } from '../employees/employees.service.js';
import { MenuService } from '../menu/menu.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import { ClockService } from '../../common/clock/clock.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { KitchenService } from './kitchen.service.js';

/**
 * Kitchen board and unit transitions on the real test database.
 * PDF §4.7. Fixtures go through the real services; CONFIRMED is
 * set directly as fixture state (the cut-off path is covered by
 * the orders spec); time is a frozen fake clock.
 */

const NOW = new Date('2026-10-05T09:00:00.000Z');
const FRIDAY = '2026-10-09';

interface Fixture {
  employeeId: string;
  dishId: string;
  optionA: string;
  optionB: string;
  actorId: string;
}

describe('KitchenService', () => {
  const prisma = new PrismaService(requireTestDatabaseUrl());
  const clock = new ClockService();
  const pricing = new PricingService(prisma);
  const orders = new OrdersService(prisma, pricing, clock);
  const kitchen = new KitchenService(prisma, clock);

  beforeEach(async () => {
    await truncateAll(prisma);
    await ensureBaseData(prisma);
    clock.setNow(NOW);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function setup(): Promise<Fixture> {
    const catalogue = new CatalogueService(prisma);
    const employees = new EmployeesService(prisma);
    const menu = new MenuService(prisma, pricing);
    const { id: companyId } = await createTestCompany(prisma);
    const employee = await employees.createEmployee(companyId, {
      name: 'Kim Kitchen',
      email: `kim.k.${Date.now()}.${Math.floor(Math.random() * 100000)}@acme.test`,
    });
    const optionA = await catalogue.createOption({ name: 'Rice A', costCents: 40 });
    const optionB = await catalogue.createOption({ name: 'Rice B', costCents: 50 });
    const station = await catalogue.createReference('stations', { name: 'Hot' });
    const dish = await catalogue.createDish({
      name: 'Bowl',
      description: null,
      imageUrl: null,
      sku: `BWL-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      temperature: 'HOT',
      costCents: 310,
      stationId: station.id,
      minOrderQuantity: null,
      allergenIds: [],
      dietaryTagIds: [],
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
    return { employeeId: employee.id, dishId: dish.id, optionA: optionA.id, optionB: optionB.id, actorId: actor.id };
  }

  function twoCombos(dishId: string, optionA: string, optionB: string): Array<{
    dishId: string;
    combinations: Array<{ quantity: number; choices: Array<{ optionId: string }> }>;
  }> {
    return [
      {
        dishId,
        combinations: [
          { quantity: 1, choices: [{ optionId: optionA }] },
          { quantity: 1, choices: [{ optionId: optionB }] },
        ],
      },
    ];
  }

  async function confirmedOrder(
    fx: Fixture,
    lines: Array<{
      dishId: string;
      combinations: Array<{ quantity: number; choices: Array<{ optionId: string }> }>;
    }>,
  ): Promise<string> {
    const created = await orders.createOrder(fx.actorId, {
      employeeId: fx.employeeId,
      deliveryDate: FRIDAY,
      lines,
    });
    await orders.placeOrder(created.id, fx.actorId, 0);
    await prisma.order.update({ where: { id: created.id }, data: { status: 'CONFIRMED' } });
    return created.id;
  }

  async function unitIds(orderId: string): Promise<string[]> {
    const units = await prisma.orderLineCombination.findMany({
      where: { line: { orderId } },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    return units.map((row) => row.id);
  }

  it('lists confirmed units on the board with station routing', async () => {
    const fx = await setup();
    await confirmedOrder(fx, twoCombos(fx.dishId, fx.optionA, fx.optionB));
    const board = await kitchen.board({ date: FRIDAY });
    expect(board.date).toBe(FRIDAY);
    expect(board.units).toHaveLength(2);
    expect(board.units[0]?.stationName).toBe('Hot');
    expect(board.units[0]?.lateness).toBe('ON_TRACK');
  });

  it('rejects a second start with 409', async () => {
    const fx = await setup();
    const id = await confirmedOrder(fx, twoCombos(fx.dishId, fx.optionA, fx.optionB));
    const [first] = await unitIds(id);
    await kitchen.startUnit(first as string, fx.actorId);
    await expect(kitchen.startUnit(first as string, fx.actorId)).rejects.toMatchObject({
      code: 'UNIT_ALREADY_STARTED',
    });
  });

  it('rejects a second done with 409 and records start on done-without-start', async () => {
    const fx = await setup();
    const id = await confirmedOrder(fx, twoCombos(fx.dishId, fx.optionA, fx.optionB));
    const [first] = await unitIds(id);
    await kitchen.doneUnit(first as string, fx.actorId);
    const row = await prisma.orderLineCombination.findUniqueOrThrow({ where: { id: first } });
    expect(row.startedAt).not.toBeNull();
    expect(row.doneAt).not.toBeNull();
    await expect(kitchen.doneUnit(first as string, fx.actorId)).rejects.toMatchObject({
      code: 'UNIT_ALREADY_DONE',
    });
  });

  it('sets ready only when every unit is done, surviving parallel last-two dones', async () => {
    const fx = await setup();
    const id = await confirmedOrder(fx, twoCombos(fx.dishId, fx.optionA, fx.optionB));
    const [first, second] = await unitIds(id);
    await kitchen.doneUnit(first as string, fx.actorId);
    const mid = await prisma.order.findUniqueOrThrow({ where: { id } });
    expect(mid.kitchenReadyAt).toBeNull();
    const results = await Promise.allSettled([
      kitchen.doneUnit(second as string, fx.actorId),
      kitchen.doneUnit(first as string, fx.actorId),
    ]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((row) => row.status === 'rejected')).toHaveLength(1);
    const done = await prisma.order.findUniqueOrThrow({ where: { id } });
    expect(done.kitchenReadyAt).not.toBeNull();
    const readyEvents = await prisma.orderEvent.count({ where: { orderId: id, type: 'KITCHEN_READY' } });
    expect(readyEvents).toBe(1);
  });

  it('sets ready once under two parallel dones on the last two open units', async () => {
    const fx = await setup();
    const id = await confirmedOrder(fx, twoCombos(fx.dishId, fx.optionA, fx.optionB));
    const [first, second] = await unitIds(id);
    const results = await Promise.allSettled([
      kitchen.doneUnit(first as string, fx.actorId),
      kitchen.doneUnit(second as string, fx.actorId),
    ]);
    expect(results.every((row) => row.status === 'fulfilled')).toBe(true);
    const done = await prisma.order.findUniqueOrThrow({ where: { id } });
    expect(done.kitchenReadyAt).not.toBeNull();
    expect(done.kitchenStartedAt).not.toBeNull();
    const readyEvents = await prisma.orderEvent.count({ where: { orderId: id, type: 'KITCHEN_READY' } });
    expect(readyEvents).toBe(1);
  });

  it('refuses work on non-confirmed orders', async () => {
    const fx = await setup();
    const created = await orders.createOrder(fx.actorId, {
      employeeId: fx.employeeId,
      deliveryDate: FRIDAY,
      lines: [
        {
          dishId: fx.dishId,
          combinations: [{ quantity: 2, choices: [{ optionId: fx.optionA }] }],
        },
      ],
    });
    const units = await prisma.orderLineCombination.findMany({
      where: { line: { orderId: created.id } },
      select: { id: true },
    });
    await expect(kitchen.startUnit(units[0]?.id as string, fx.actorId)).rejects.toMatchObject({
      code: 'ORDER_NOT_CONFIRMED',
    });
  });

  it('force-completes a whole order and bumps the version', async () => {
    const fx = await setup();
    const id = await confirmedOrder(fx, twoCombos(fx.dishId, fx.optionA, fx.optionB));
    const before = await prisma.order.findUniqueOrThrow({ where: { id } });
    const result = await kitchen.forceComplete(id, fx.actorId, before.version);
    expect(result.version).toBe(before.version + 1);
    const after = await prisma.order.findUniqueOrThrow({ where: { id } });
    expect(after.kitchenReadyAt).not.toBeNull();
    const open = await prisma.orderLineCombination.count({
      where: { line: { orderId: id }, doneAt: null },
    });
    expect(open).toBe(0);
    await expect(kitchen.forceComplete(id, fx.actorId, before.version)).rejects.toMatchObject({
      code: 'ORDER_STATE_CONFLICT',
    });
  });
});
