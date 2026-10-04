import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createEmployeeSchema,
  csvImportSchema,
  paginationSchema,
  updateEmployeeSchema,
} from '@repo/shared';
import type {
  CreateEmployeeInput,
  CsvImportInput,
  UpdateEmployeeInput,
} from '@repo/shared';
import { RequirePermission } from '../auth/auth.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { EmployeesService } from './employees.service.js';

/**
 * Employee endpoints, scoped under their company.
 * Reads need `employees.read`; every write needs `employees.manage`.
 */
@Controller('companies/:companyId/employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @RequirePermission('employees.read')
  @Get()
  listEmployees(
    @Param('companyId') companyId: string,
    @Query(new ZodValidationPipe(paginationSchema)) query: { page: number; pageSize: number },
  ) {
    return this.employees.listEmployees(companyId, query.page ?? 1, query.pageSize ?? 20);
  }

  @RequirePermission('employees.manage')
  @Post()
  createEmployee(
    @Param('companyId') companyId: string,
    @Body(new ZodValidationPipe(createEmployeeSchema)) body: CreateEmployeeInput,
  ) {
    return this.employees.createEmployee(companyId, body);
  }

  @RequirePermission('employees.manage')
  @Post('import')
  importCsv(
    @Param('companyId') companyId: string,
    @Body(new ZodValidationPipe(csvImportSchema)) body: CsvImportInput,
  ) {
    return this.employees.importCsv(companyId, body.content);
  }
}

@Controller('employees')
export class EmployeeController {
  constructor(private readonly employees: EmployeesService) {}

  @RequirePermission('employees.manage')
  @Patch(':id')
  updateEmployee(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateEmployeeSchema)) body: UpdateEmployeeInput,
  ) {
    return this.employees.updateEmployee(id, body);
  }

  @RequirePermission('employees.manage')
  @Post(':id/deactivate')
  deactivateEmployee(@Param('id') id: string) {
    return this.employees.setEmployeeActive(id, false);
  }

  @RequirePermission('employees.manage')
  @Post(':id/activate')
  activateEmployee(@Param('id') id: string) {
    return this.employees.setEmployeeActive(id, true);
  }
}
