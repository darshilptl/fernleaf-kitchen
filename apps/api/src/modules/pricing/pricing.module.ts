import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { PricingController } from './pricing.controller.js';
import { PricingService } from './pricing.service.js';

@Module({
  controllers: [PricingController],
  providers: [PricingService, PrismaService],
  exports: [PricingService],
})
export class PricingModule {}
