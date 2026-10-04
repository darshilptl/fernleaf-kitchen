import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { EmployeeController, EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';

@Module({
  controllers: [EmployeesController, EmployeeController],
  providers: [EmployeesService, PrismaService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
