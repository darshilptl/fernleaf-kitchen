import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service.js';
import { requireTestDatabaseUrl, truncateAll } from '../../../test/db.js';
import { ensureBaseData } from '../auth/base-data.js';
import { ClockService } from '../../common/clock/clock.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import { OrdersService } from './orders.service.js';
import { CutoffScheduler } from './cutoff-scheduler.js';

/**
 * Cut-off scheduler wiring. PDF §4.6. The processing math lives
 * in `OrdersService.runCutoff` (tested in orders.spec.ts); here
 * only the startup catch-up and the minute tick smoke.
 */
describe('CutoffScheduler', () => {
  const prisma = new PrismaService(requireTestDatabaseUrl());
  const clock = new ClockService();
  const scheduler = new CutoffScheduler(
    new OrdersService(prisma, new PricingService(prisma), clock),
    clock,
  );

  beforeEach(async () => {
    await truncateAll(prisma);
    await ensureBaseData(prisma);
    clock.setNow(new Date('2026-10-05T09:00:00.000Z'));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('runs the startup catch-up with no open orders', async () => {
    await expect(scheduler.onModuleInit()).resolves.toBeUndefined();
    await expect(scheduler.handleCron()).resolves.toBeUndefined();
  });
});
