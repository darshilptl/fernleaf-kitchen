import { Module } from '@nestjs/common';
import { ClockService } from '../../common/clock/clock.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { KitchenController } from './kitchen.controller.js';
import { KitchenService } from './kitchen.service.js';

@Module({
  controllers: [KitchenController],
  providers: [KitchenService, ClockService, PrismaService],
  exports: [KitchenService],
})
export class KitchenModule {}
