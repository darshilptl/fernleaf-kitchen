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
import { DispatchService } from './dispatch.service.js';
import { groupIntoDrops } from './domain/group-drops.js';

/**
 * Dispatch drops on the real test database. PDF §4.8.
 * CONFIRMED and chain timestamps are fixture state (the cut-off
 * path is covered by the orders spec); the clock is frozen.
 */

const NOW = new Date('2026-10-05T09:00:00.000Z');
const FRIDAY = '2026-10-09';

interface Fixture {
  companyId: string;
  addressId: string;
  employeeA: string;
  employeeB: string;
  dishId: string;
  optionA: string;
  actorId: string;
  driverId: string;
}

describe('DispatchService drops', () => {
  const prisma = new PrismaService(requireTestDatabaseUrl());
  const clock = new ClockService();
  const pricing = new PricingService(prisma);
  const orders = new OrdersService(prisma, pricing, clock);
  const dispatch = new DispatchService(prisma, clock);

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
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { addresses: { select: { id: true } }, defaultDeliveryMinute: true },
    });
    const employeeA = await employees.createEmployee(companyId, {
      name: 'Amy Dispatch',
      email: `amy.${Date.now()}.${Math.floor(Math.random() * 100000)}@acme.test`,
    });
    const employeeB = await employees.createEmployee(companyId, {
      name: 'Bob Dispatch',
      email: `bob.${Date.now()}.${Math.floor(Math.random() * 100000)}@acme.test`,
    });
    const optionA = await catalogue.createOption({ name: 'Rice A', costCents: 40 });
    const dish = await catalogue.createDish({
      name: 'Bowl',
      description: null,
      imageUrl: null,
      sku: `BWL-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      temperature: 'HOT',
      costCents: 310,
      stationId: null,
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
    const tier = await pricing.createTier({ name: 'Standard' });
    await pricing.saveBatchPrices(tier.id, {
      dishPrices: [{ itemId: dish.id, priceCents: 700 }],
      optionPrices: [{ itemId: optionA.id, priceCents: 0 }],
    });
    const category = await menu.createCategory({ name: 'Bowls' });
    await menu.addPlacement(category.id, { dishId: dish.id });
    const actor = await prisma.staffUser.findUniqueOrThrow({ where: { email: 'admin@test.com' } });
    const driver = await prisma.staffUser.findUniqueOrThrow({ where: { email: 'driver@test.com' } });
    return {
      companyId,
      addressId: company.addresses[0]?.id as string,
      employeeA: employeeA.id,
      employeeB: employeeB.id,
      dishId: dish.id,
      optionA: optionA.id,
      actorId: actor.id,
      driverId: driver.id,
    };
  }

  function line(dishId: string, optionId: string): {
    dishId: string;
    combinations: Array<{ quantity: number; choices: Array<{ optionId: string }> }>;
  } {
    return { dishId, combinations: [{ quantity: 2, choices: [{ optionId }] }] };
  }

  async function confirmedOrder(fx: Fixture, employeeId: string): Promise<string> {
    const created = await orders.createOrder(fx.actorId, {
      employeeId,
      deliveryDate: FRIDAY,
      lines: [line(fx.dishId, fx.optionA)],
    });
    await orders.placeOrder(created.id, fx.actorId, 0);
    await prisma.order.update({ where: { id: created.id }, data: { status: 'CONFIRMED' } });
    return created.id;
  }

  function dropKey(fx: Fixture): {
    companyId: string;
    addressId: string;
    deliveryDate: string;
    deliveryTimeMinute: number;
  } {
    return {
      companyId: fx.companyId,
      addressId: fx.addressId,
      deliveryDate: FRIDAY,
      deliveryTimeMinute: 720,
    };
  }

  it('groups same company, address and time into one drop', async () => {
    const fx = await setup();
    await confirmedOrder(fx, fx.employeeA);
    await confirmedOrder(fx, fx.employeeB);
    const listed = (await dispatch.listDrops(FRIDAY)) as {
      drops: Array<{ memberIds: string[]; status: string }>;
    };
    expect(listed.drops).toHaveLength(1);
    expect(listed.drops[0]?.memberIds).toHaveLength(2);
    expect(listed.drops[0]?.status).toBe('CONFIRMED');
  });

  it('shows delivered orders on the board without grouping them as actionable', async () => {
    const fx = await setup();
    const id = await confirmedOrder(fx, fx.employeeA);
    await prisma.order.update({ where: { id }, data: { status: 'DELIVERED' } });
    const groups = groupIntoDrops([
      {
        id,
        companyId: fx.companyId,
        addressId: fx.addressId,
        deliveryDate: FRIDAY,
        deliveryTimeMinute: 720,
        status: 'DELIVERED',
        kitchenReadyAt: null,
        dispatchReadyAt: null,
        outForDeliveryAt: null,
        driverId: null,
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.status).toBe('DELIVERED');
  });

  it('requires kitchen ready before dispatch ready, and blocks repeats', async () => {
    const fx = await setup();
    await confirmedOrder(fx, fx.employeeA);
    const key = dropKey(fx);
    await expect(dispatch.markDispatchReady(key, fx.actorId)).rejects.toMatchObject({
      code: 'DROP_PREVIOUS_STEP_MISSING',
    });
    await prisma.order.updateMany({
      where: { companyId: fx.companyId },
      data: { kitchenReadyAt: NOW },
    });
    const first = await dispatch.markDispatchReady(key, fx.actorId);
    expect(first.updated).toBe(1);
    await expect(dispatch.markDispatchReady(key, fx.actorId)).rejects.toMatchObject({
      code: 'DROP_STEP_ALREADY_DONE',
    });
  });

  it('requires dispatch ready and a driver before out for delivery', async () => {
    const fx = await setup();
    await confirmedOrder(fx, fx.employeeA);
    const key = dropKey(fx);
    await prisma.order.updateMany({
      where: { companyId: fx.companyId },
      data: { kitchenReadyAt: NOW, dispatchReadyAt: NOW },
    });
    await expect(dispatch.markOutForDelivery(key, fx.actorId)).rejects.toMatchObject({
      code: 'DROP_PREVIOUS_STEP_MISSING',
    });
    await dispatch.assignDriver(key, fx.driverId, fx.actorId);
    const moved = await dispatch.markOutForDelivery(key, fx.actorId);
    expect(moved.updated).toBe(1);
    await expect(dispatch.assignDriver(key, fx.driverId, fx.actorId)).rejects.toMatchObject({
      code: 'DROP_ALREADY_OUT',
    });
  });

  it('returns 404 for an unknown drop', async () => {
    const fx = await setup();
    const key = { ...dropKey(fx), deliveryTimeMinute: 600 };
    await expect(dispatch.markDispatchReady(key, fx.actorId)).rejects.toMatchObject({
      code: 'DROP_NOT_FOUND',
    });
  });

  it('rejects an ineligible driver', async () => {
    const fx = await setup();
    await confirmedOrder(fx, fx.employeeA);
    await expect(dispatch.assignDriver(dropKey(fx), fx.actorId, fx.actorId)).rejects.toMatchObject({
      code: 'DRIVER_INELIGIBLE',
    });
  });
});
