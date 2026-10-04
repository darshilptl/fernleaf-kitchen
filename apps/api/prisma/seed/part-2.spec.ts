import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/database/prisma.service.js';
import { requireTestDatabaseUrl, truncateAll } from '../../test/db.js';
import { ensureBaseData } from '../../src/modules/auth/base-data.js';
import { seedPart1 } from './part-1.js';
import { seedPart2 } from './part-2.js';

/**
 * Demo data part 2. PDF §2 + skill seed-demo-data.
 * Runs the real part-1 first (dishes, tiers, companies), then
 * asserts the status spread, reconciled totals, reviewer safety,
 * and same-day idempotency. Generous timeouts: full-demo seeding
 * over the pooler is slow but must stay green.
 */
describe('seed part 2', () => {
  const prisma = new PrismaService(requireTestDatabaseUrl());
  // Fixed Monday morning UTC: Acme serves today, Wednesday+ unlock.
  const now = new Date('2026-10-05T02:00:00.000Z');

  beforeEach(async () => {
    await truncateAll(prisma);
    await ensureBaseData(prisma);
    await seedPart1(prisma);
  }, 120000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it(
    'seeds every status with reconciled totals, then creates nothing twice',
    async () => {
      const first = await seedPart2(prisma, now);
      expect(first.skipped).toBe(false);
      expect(first.orders).toBeGreaterThan(8);
      expect(first.invoices).toBe(2);

      const seedUser = await prisma.staffUser.findUniqueOrThrow({ where: { email: 'seed@fernleaf.test' } });
      const statuses = await prisma.order.groupBy({
        by: ['status'],
        where: { createdById: seedUser.id },
        _count: true,
      });
      expect(statuses.map((row) => row.status)).toEqual(
        expect.arrayContaining(['DELIVERED', 'CANCELLED', 'REJECTED', 'CONFIRMED', 'PLACED', 'DRAFT']),
      );

      // Totals reconcile: order = sum(lines) = sum(combos); invoice = sum(orders).
      const orders = await prisma.order.findMany({
        include: { lines: { include: { combinations: true } } },
      });
      for (const order of orders) {
        const linesTotal = order.lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
        expect(order.totalCents).toBe(linesTotal);
        for (const line of order.lines) {
          const combosTotal = line.combinations.reduce((sum, combo) => sum + combo.totalCents, 0);
          expect(line.lineTotalCents).toBe(combosTotal);
          expect(line.quantity).toBe(
            line.combinations.reduce((sum, combo) => sum + combo.quantity, 0),
          );
        }
      }
      const invoices = await prisma.invoice.findMany({ include: { orders: true } });
      expect(invoices.filter((row) => row.paidAt !== null)).toHaveLength(1);
      expect(invoices.filter((row) => row.paidAt === null)).toHaveLength(1);
      for (const invoice of invoices) {
        const sum = invoice.orders.reduce((total, order) => total + order.totalCents, 0);
        expect(invoice.totalCents).toBe(sum);
      }

      // Driver has drops today at several stages.
      const driver = await prisma.staffUser.findUniqueOrThrow({ where: { email: 'driver@test.com' } });
      const drops = await prisma.order.count({
        where: { driverId: driver.id, createdById: seedUser.id },
      });
      expect(drops).toBeGreaterThan(0);

      const before = await prisma.order.count();
      const second = await seedPart2(prisma, now);
      expect(second).toMatchObject({ orders: 0, invoices: 0, skipped: true });
      expect(await prisma.order.count()).toBe(before);
    },
    180000,
  );

  it(
    'leaves reviewer rows alone',
    async () => {
      await seedPart2(prisma, now);
      const admin = await prisma.staffUser.findUniqueOrThrow({ where: { email: 'admin@test.com' } });
      const employee = await prisma.employee.findUniqueOrThrow({
        where: { email: 'riya.shah@acme-foods.example' },
      });
      // Reviewer rows are arbitrary by nature: raw insert simulates a
      // hand-made order the seed must never touch.
      const kept = await prisma.order.create({
        data: {
          employeeId: employee.id,
          companyId: employee.companyId,
          createdById: admin.id,
          deliveryDate: new Date('2026-10-09T00:00:00.000Z'),
          deliveryTimeMinute: 720,
          addressId: (
            await prisma.companyAddress.findFirstOrThrow({
              where: { companyId: employee.companyId, isDefault: true },
            })
          ).id,
          packagingTypeId: (
            await prisma.packagingType.findFirstOrThrow({ where: { name: 'Standard box' } })
          ).id,
          totalCents: 100,
          status: 'DRAFT',
        },
        select: { id: true },
      });
      await seedPart2(prisma, now);
      const row = await prisma.order.findUniqueOrThrow({
        where: { id: kept.id },
        select: { status: true, totalCents: true },
      });
      expect(row).toMatchObject({ status: 'DRAFT', totalCents: 100 });
    },
    180000,
  );

});
