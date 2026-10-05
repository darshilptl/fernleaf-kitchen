import { Module } from '@nestjs/common';
import { ClockService } from '../../common/clock/clock.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { BillingService } from '../billing/billing.service.js';
import { DispatchService } from '../dispatch/dispatch.service.js';
import { KitchenService } from '../kitchen/kitchen.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import { MenuService } from '../menu/menu.service.js';
import { StaffService } from '../staff/staff.service.js';
import { DemoDataService } from './demo-data.service.js';

@Module({
  providers: [
    DemoDataService,
    PrismaService,
    ClockService,
    PricingService,
    OrdersService,
    KitchenService,
    DispatchService,
    BillingService,
    StaffService,
    MenuService,
  ],
  exports: [DemoDataService],
})
export class DemoDataModule {}
