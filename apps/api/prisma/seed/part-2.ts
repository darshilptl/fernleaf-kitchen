import { PrismaService } from '../../src/database/prisma.service.js';
import { BillingService } from '../../src/modules/billing/billing.service.js';
import { ClockService } from '../../src/common/clock/clock.service.js';
import { DispatchService } from '../../src/modules/dispatch/dispatch.service.js';
import { KitchenService } from '../../src/modules/kitchen/kitchen.service.js';
import { MenuService } from '../../src/modules/menu/menu.service.js';
import { OrdersService } from '../../src/modules/orders/orders.service.js';
import { PricingService } from '../../src/modules/pricing/pricing.service.js';
import { StaffService } from '../../src/modules/staff/staff.service.js';
import { DemoDataService } from '../../src/modules/demo-data/demo-data.service.js';

/**
 * Thin CLI wrapper over `DemoDataService` for `pnpm db:seed`.
 * Wires the services manually (no Nest DI outside the server).
 */
export async function seedPart2(prisma: PrismaService, now?: Date): Promise<void> {
  const clock = new ClockService();
  if (now !== undefined) {
    clock.setNow(now);
  }
  const pricing = new PricingService(prisma);
  const demo = new DemoDataService(
    prisma,
    pricing,
    new OrdersService(prisma, pricing, clock),
    new KitchenService(prisma, clock),
    new DispatchService(prisma, clock),
    new BillingService(prisma, clock),
    new StaffService(prisma),
    new MenuService(prisma, pricing),
    clock,
  );
  await demo.ensureDemoData();
}
