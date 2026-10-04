import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CompaniesController } from './companies.controller.js';
import { CompaniesService } from './companies.service.js';
import { StaffDriversController } from './staff-drivers.controller.js';

@Module({
  controllers: [CompaniesController, StaffDriversController],
  providers: [CompaniesService, PrismaService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
