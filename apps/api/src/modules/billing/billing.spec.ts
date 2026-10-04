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
import { BillingService } from './billing.service.js';

/**
 * Billing on the real test database. PDF §4.9 / D-53, D-74.
 * Billable = CONFIRMED or DELIVERED, uninvoiced. Invoice totals
 * freeze at creation and always equal the member sum.
 */

const NOW = new Date('2026-10-05T09:00:00.000Z');
const FRIDAY = '2026-10-09';

interface Fixture {
  companyId: string;
  employeeId: string;
  dishId: string;
  optionA: string;
  actorId: string;
}

describe('BillingService', () => {
  const prisma = new PrismaService(requireTestDatabaseUrl());
  const clock = new ClockService();
  const pricing = new PricingService(prisma);
  const orders = new OrdersService(prisma, pricing, clock);
  const billing = new BillingService(prisma, clock);

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
      name: 'Kim Bill',
      email: `kim.b.${Date.now()}.${Math.floor(Math.random() * 100000)}@acme.test`,
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
    return { companyId, employeeId: employee.id, dishId: dish.id, optionA: optionA.id, actorId: actor.id };
  }

  async function confirmedOrder(fx: Fixture, quantity = 2): Promise<string> {
    const created = await orders.createOrder(fx.actorId, {
      employeeId: fx.employeeId,
      deliveryDate: FRIDAY,
      lines: [
        {
          dishId: fx.dishId,
          combinations: [{ quantity, choices: [{ optionId: fx.optionA }] }],
        },
      ],
    });
    await orders.placeOrder(created.id, fx.actorId, 0);
    await prisma.order.update({ where: { id: created.id }, data: { status: 'CONFIRMED' } });
    return created.id;
  }

  it('creates an invoice whose total equals the sum of its orders', async () => {
    const fx = await setup();
    const first = await confirmedOrder(fx, 2);
    const second = await confirmedOrder(fx, 1);
    const billable = (await billing.billable(fx.companyId)) as { orders: Array<{ id: string }> };
    expect(billable.orders).toHaveLength(2);
    const invoice = await billing.createInvoice(fx.companyId, [first, second], fx.actorId);
    const rows = await prisma.order.findMany({
      where: { id: { in: [first, second] } },
      select: { totalCents: true },
    });
    expect(invoice.totalCents).toBe(rows.reduce((sum, row) => sum + row.totalCents, 0));
    const again = (await billing.billable(fx.companyId)) as { orders: unknown[] };
    expect(again.orders).toHaveLength(0);
  });

  it('lets only one of two parallel invoice creates win', async () => {
    const fx = await setup();
    const id = await confirmedOrder(fx);
    const results = await Promise.allSettled([
      billing.createInvoice(fx.companyId, [id], fx.actorId),
      billing.createInvoice(fx.companyId, [id], fx.actorId),
    ]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((row) => row.status === 'rejected')).toHaveLength(1);
    expect((results.find((row) => row.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({
      code: 'INVOICE_ORDERS_NOT_BILLABLE',
    });
  });

  it('rejects non-billable orders', async () => {
    const fx = await setup();
    const draft = await orders.createOrder(fx.actorId, {
      employeeId: fx.employeeId,
      deliveryDate: FRIDAY,
    });
    await expect(
      billing.createInvoice(fx.companyId, [draft.id], fx.actorId),
    ).rejects.toMatchObject({ code: 'INVOICE_ORDERS_NOT_BILLABLE' });
  });

  it('removes an order from an unpaid invoice, recalculates, and deletes when empty', async () => {
    const fx = await setup();
    const first = await confirmedOrder(fx, 2);
    const second = await confirmedOrder(fx, 1);
    const invoice = await billing.createInvoice(fx.companyId, [first, second], fx.actorId);
    const reduced = (await billing.removeOrder(invoice.id, first, fx.actorId)) as {
      id: string;
      totalCents: number;
    };
    const remaining = await prisma.order.findUniqueOrThrow({ where: { id: second } });
    expect(reduced.totalCents).toBe(remaining.totalCents);
    const gone = await billing.removeOrder(invoice.id, second, fx.actorId);
    expect(gone).toMatchObject({ deleted: true });
    const missing = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(missing).toBeNull();
  });

  it('keeps paid invoices immutable and rejects a second pay', async () => {
    const fx = await setup();
    const id = await confirmedOrder(fx);
    const invoice = await billing.createInvoice(fx.companyId, [id], fx.actorId);
    await billing.markPaid(invoice.id, fx.actorId);
    await expect(billing.markPaid(invoice.id, fx.actorId)).rejects.toMatchObject({
      code: 'INVOICE_ALREADY_PAID',
    });
    await expect(billing.removeOrder(invoice.id, id, fx.actorId)).rejects.toMatchObject({
      code: 'INVOICE_PAID_IMMUTABLE',
    });
  });

  it('blocks cancel of an invoiced order until it is removed', async () => {
    const fx = await setup();
    const id = await confirmedOrder(fx);
    const invoice = await billing.createInvoice(fx.companyId, [id], fx.actorId);
    const row = await prisma.order.findUniqueOrThrow({ where: { id } });
    await expect(orders.cancelOrder(id, fx.actorId, row.version, true)).rejects.toMatchObject({
      code: 'ORDER_INVOICED',
    });
    await billing.removeOrder(invoice.id, id, fx.actorId);
    const fresh = await prisma.order.findUniqueOrThrow({ where: { id } });
    await orders.cancelOrder(id, fx.actorId, fresh.version, true);
    const cancelled = await prisma.order.findUniqueOrThrow({ where: { id } });
    expect(cancelled.status).toBe('CANCELLED');
  });
});
