import { Module } from '@nestjs/common';
import { ClockService } from '../../common/clock/clock.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { DashboardsController } from './dashboards.controller.js';
import { DashboardsService } from './dashboards.service.js';

@Module({
  imports: [PricingModule],
  controllers: [DashboardsController],
  providers: [DashboardsService, ClockService, PrismaService],
  exports: [DashboardsService],
})
export class DashboardsModule {}
