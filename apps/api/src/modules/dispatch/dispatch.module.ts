import { Module } from '@nestjs/common';
import { ClockService } from '../../common/clock/clock.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { DispatchController } from './dispatch.controller.js';
import { DriverController } from './driver.controller.js';
import { DispatchService } from './dispatch.service.js';

@Module({
  controllers: [DispatchController, DriverController],
  providers: [DispatchService, ClockService, PrismaService],
  exports: [DispatchService],
})
export class DispatchModule {}
