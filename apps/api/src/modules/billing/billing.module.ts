import { Module } from '@nestjs/common';
import { ClockService } from '../../common/clock/clock.service.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';

@Module({
  controllers: [BillingController],
  providers: [BillingService, ClockService],
  exports: [BillingService],
})
export class BillingModule {}
