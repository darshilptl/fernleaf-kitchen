import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ClockService } from '../../common/clock/clock.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { CutoffScheduler } from './cutoff-scheduler.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [ScheduleModule.forRoot(), PricingModule],
  controllers: [OrdersController],
  providers: [OrdersService, CutoffScheduler, ClockService, PrismaService],
  exports: [OrdersService],
})
export class OrdersModule {}
