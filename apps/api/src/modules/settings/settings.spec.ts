import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service.js';
import { requireTestDatabaseUrl, truncateAll } from '../../../test/db.js';
import { ensureBaseData } from '../auth/base-data.js';
import { ClockService } from '../../common/clock/clock.service.js';
import { BillingService } from '../billing/billing.service.js';
import { DispatchService } from '../dispatch/dispatch.service.js';
import { KitchenService } from '../kitchen/kitchen.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import { StaffService } from '../staff/staff.service.js';
import { MenuService } from '../menu/menu.service.js';
import { DemoDataService } from '../demo-data/demo-data.service.js';
import { SettingsService } from './settings.service.js';

/**
 * Platform settings and kitchen holidays. PDF §4.10.
 * The settings row is bootstrapped by `ensureBaseData`;
 * holidays are plain add/remove with unique dates.
 */
describe('SettingsService', () => {
  const prisma = new PrismaService(requireTestDatabaseUrl());
  const clock = new ClockService();
  const pricing = new PricingService(prisma);
  const settings = new SettingsService(
    prisma,
    new DemoDataService(
      prisma,
      pricing,
      new OrdersService(prisma, pricing, clock),
      new KitchenService(prisma, clock),
      new DispatchService(prisma, clock),
      new BillingService(prisma, clock),
      new StaffService(prisma),
      new MenuService(prisma, pricing),
      clock,
    ),
  );

  beforeEach(async () => {
    await truncateAll(prisma);
    await ensureBaseData(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('bootstraps the settings row with kitchen defaults', async () => {
    const row = await settings.getSettings();
    expect(row).toMatchObject({
      kitchenWorkingDays: [1, 2, 3, 4, 5],
      cutoffTimeMinute: 960,
      cutoffWorkingDays: 2,
      atRiskMinutes: 30,
    });
  });

  it('updates the settings row', async () => {
    await settings.updateSettings({
      kitchenWorkingDays: [1, 2, 3, 4, 5, 6],
      cutoffTimeMinute: 900,
      cutoffWorkingDays: 1,
      atRiskMinutes: 45,
    });
    const row = await settings.getSettings();
    expect(row.cutoffTimeMinute).toBe(900);
    expect(row.cutoffWorkingDays).toBe(1);
    expect(row.atRiskMinutes).toBe(45);
  });

  it('adds and removes a kitchen holiday', async () => {
    const created = await settings.addHoliday({ date: '2026-10-09', name: 'Demo day off' });
    const holidays = await settings.listHolidays();
    expect(holidays.map((row) => row.date)).toContain('2026-10-09');
    await settings.removeHoliday(created.id);
    const after = await settings.listHolidays();
    expect(after.map((row) => row.date)).not.toContain('2026-10-09');
  });

  it('rejects a duplicate holiday date', async () => {
    await settings.addHoliday({ date: '2026-10-09', name: null });
    await expect(settings.addHoliday({ date: '2026-10-09', name: null })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });
});
