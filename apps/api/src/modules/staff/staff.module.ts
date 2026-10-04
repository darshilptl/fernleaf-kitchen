import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { StaffController } from './staff.controller.js';
import { StaffService } from './staff.service.js';

@Module({
  controllers: [StaffController],
  providers: [StaffService, PrismaService],
  exports: [StaffService],
})
export class StaffModule {}
