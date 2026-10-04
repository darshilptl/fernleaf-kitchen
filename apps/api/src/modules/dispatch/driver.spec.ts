import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
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
import { kitchenToday, toDbDate, toKitchenInstant } from '@repo/shared';
import type { DropKeyData } from '@repo/shared';

/**
 * Driver view on the real test database. PDF §4.8 / D-70, D-71.
 * Ownership sits inside the query: a foreign drop reads as zero
 * rows -> 404. On-time has no grace; equality counts as on time.
 */

const NOW = new Date('2026-10-05T09:00:00.000Z');

interface Fixture {
  companyId: string;
  addressId: string;
  employeeId: string;
  dishId: string;
  optionA: string;
  actorId: string;
  driverId: string;
  otherDriverId: string;
}

describe('DispatchService driver view', () => {
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
      select: { addresses: { select: { id: true } } },
    });
    const employee = await employees.createEmployee(companyId, {
      name: 'Amy Driver',
      email: `amy.d.${Date.now()}.${Math.floor(Math.random() * 100000)}@acme.test`,
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
    const driverRole = await prisma.role.findUniqueOrThrow({ where: { key: 'driver' } });
    const other = await prisma.staffUser.create({
      data: {
        email: `other.${Date.now()}@acme.test`,
        name: 'Other Driver',
        passwordHash: await bcrypt.hash('Test@1234', 4),
        roleId: driverRole.id,
        isActive: true,
      },
      select: { id: true },
    });
    return {
      companyId,
      addressId: company.addresses[0]?.id as string,
      employeeId: employee.id,
      dishId: dish.id,
      optionA: optionA.id,
      actorId: actor.id,
      driverId: driver.id,
      otherDriverId: other.id,
    };
  }

  /**
   * Build a dispatchable drop for `deliveryDate` (usually today).
   * Lines price through the real order flow on a working-day
   * Friday; the finished order is then re-dated to the target day
   * as fixture state (same-day creation would fail the company
   * calendar and cut-off rules, which the orders spec covers).
   */
  async function readyDrop(fx: Fixture, deliveryDate: string): Promise<DropKeyData> {
    const created = await orders.createOrder(fx.actorId, {
      employeeId: fx.employeeId,
      deliveryDate: '2026-10-09',
      lines: [
        {
          dishId: fx.dishId,
          combinations: [{ quantity: 2, choices: [{ optionId: fx.optionA }] }],
        },
      ],
    });
    await orders.placeOrder(created.id, fx.actorId, 0);
    await prisma.order.update({
      where: { id: created.id },
      data: {
        deliveryDate: toDbDate(deliveryDate),
        status: 'CONFIRMED',
        kitchenReadyAt: NOW,
        dispatchReadyAt: NOW,
      },
    });
    const key = {
      companyId: fx.companyId,
      addressId: fx.addressId,
      deliveryDate,
      deliveryTimeMinute: 720,
    };
    await dispatch.assignDriver(key, fx.driverId, fx.actorId);
    await dispatch.markOutForDelivery(key, fx.actorId);
    return key;
  }

  it('shows only the driver own drops for today in time order', async () => {
    const fx = await setup();
    const myDate = kitchenToday(NOW);
    await readyDrop(fx, myDate);
    const mine = (await dispatch.listOwnDrops(fx.driverId)) as { drops: unknown[] };
    const foreign = (await dispatch.listOwnDrops(fx.otherDriverId)) as { drops: unknown[] };
    expect(mine.drops).toHaveLength(1);
    expect(foreign.drops).toHaveLength(0);
  });

  it('marks delivered with note and photo, recording on-time without grace', async () => {
    const fx = await setup();
    const myDate = kitchenToday(NOW);
    const key = await readyDrop(fx, myDate);
    clock.setNow(toKitchenInstant(myDate, 720));
    const result = await dispatch.markDelivered(key, fx.driverId, 'Gate B', 'https://cdn.test/p.jpg');
    expect(result.updated).toBe(1);
    const row = await prisma.order.findFirstOrThrow({ where: { companyId: fx.companyId } });
    expect(row.status).toBe('DELIVERED');
    expect(row.deliveredOnTime).toBe(true);
    expect(row.deliveryNote).toBe('Gate B');
    expect(row.deliveryPhotoUrl).toBe('https://cdn.test/p.jpg');
  });

  it('records a late delivery past the scheduled instant', async () => {
    const fx = await setup();
    const myDate = kitchenToday(NOW);
    const key = await readyDrop(fx, myDate);
    clock.setNow(new Date(toKitchenInstant(myDate, 720).getTime() + 60_000));
    await dispatch.markDelivered(key, fx.driverId, undefined, undefined);
    const row = await prisma.order.findFirstOrThrow({ where: { companyId: fx.companyId } });
    expect(row.deliveredOnTime).toBe(false);
  });

  it('returns 404 for another driver drop', async () => {
    const fx = await setup();
    const myDate = kitchenToday(NOW);
    const key = await readyDrop(fx, myDate);
    await expect(
      dispatch.markDelivered(key, fx.otherDriverId, undefined, undefined),
    ).rejects.toMatchObject({ code: 'DROP_NOT_FOUND' });
  });

  it('requires out for delivery before delivered', async () => {
    const fx = await setup();
    const myDate = kitchenToday(NOW);
    const created = await orders.createOrder(fx.actorId, {
      employeeId: fx.employeeId,
      deliveryDate: '2026-10-09',
      lines: [
        {
          dishId: fx.dishId,
          combinations: [{ quantity: 1, choices: [{ optionId: fx.optionA }] }],
        },
      ],
    });
    await orders.placeOrder(created.id, fx.actorId, 0);
    await prisma.order.update({
      where: { id: created.id },
      data: { deliveryDate: toDbDate(myDate), status: 'CONFIRMED', driverId: fx.driverId },
    });
    await expect(
      dispatch.markDelivered(
        {
          companyId: fx.companyId,
          addressId: fx.addressId,
          deliveryDate: myDate,
          deliveryTimeMinute: 720,
        },
        fx.driverId,
        undefined,
        undefined,
      ),
    ).rejects.toMatchObject({ code: 'DROP_PREVIOUS_STEP_MISSING' });
  });

});
