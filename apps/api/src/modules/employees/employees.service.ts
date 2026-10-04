import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError, employeeCsvRowSchema, parseCsv } from '@repo/shared';
import type { CreateEmployeeInput, UpdateEmployeeInput } from '@repo/shared';
import { PrismaService } from '../../database/prisma.service.js';
import { logAction } from '../../common/logging/logging.interceptor.js';

const CSV_MAX_ROWS = 1000;

export interface CsvImportResult {
  imported: number;
  errors: Array<{ row: number; message: string }>;
}

/**
 * Employees of one company. PDF §4.5.
 * Exactly one company each; globally unique lowercase email.
 * Owner employees cannot move or deactivate until replaced (D-18).
 * Company moves are blocked while Draft/Placed orders exist (D-29).
 */
@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listEmployees(
    companyId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: unknown[]; page: number; pageSize: number; total: number }> {
    await this.requireCompany(companyId);
    const [total, items] = await this.prisma.$transaction([
      this.prisma.employee.count({ where: { companyId } }),
      this.prisma.employee.findMany({
        where: { companyId },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          canChooseAddress: true,
          canChangeDeliveryTime: true,
          canChangePackaging: true,
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items, page, pageSize, total };
  }

  async createEmployee(companyId: string, input: CreateEmployeeInput): Promise<{ id: string }> {
    await this.requireCompany(companyId);
    try {
      const employee = await this.prisma.employee.create({
        data: {
          companyId,
          name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
          canChooseAddress: input.canChooseAddress ?? false,
          canChangeDeliveryTime: input.canChangeDeliveryTime ?? false,
          canChangePackaging: input.canChangePackaging ?? false,
          allergies: { create: (input.allergenIds ?? []).map((allergenId) => ({ allergenId })) },
          dietaryPreferences: {
            create: (input.dietaryTagIds ?? []).map((tagId) => ({ tagId })),
          },
        },
        select: { id: true },
      });
      logAction(this.logger, 'employee.create', { employeeId: employee.id, companyId });
      return employee;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError({
          code: 'EMPLOYEE_EMAIL_TAKEN',
          message: 'Employee email is already used',
          httpStatus: 409,
        });
      }
      throw mapMissingReference(error);
    }
  }

  async updateEmployee(id: string, input: UpdateEmployeeInput): Promise<{ id: string }> {
    const employee = await this.requireEmployee(id);
    if (input.companyId !== undefined && input.companyId !== employee.companyId) {
      await this.moveEmployee(id, input.companyId);
    }
    if (input.isActive === false) {
      await this.assertNotOwner(id);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.companyId !== undefined ? { companyId: input.companyId } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.canChooseAddress !== undefined
            ? { canChooseAddress: input.canChooseAddress }
            : {}),
          ...(input.canChangeDeliveryTime !== undefined
            ? { canChangeDeliveryTime: input.canChangeDeliveryTime }
            : {}),
          ...(input.canChangePackaging !== undefined
            ? { canChangePackaging: input.canChangePackaging }
            : {}),
        },
      });
      if (input.allergenIds !== undefined) {
        await tx.employeeAllergen.deleteMany({ where: { employeeId: id } });
        if (input.allergenIds.length > 0) {
          await tx.employeeAllergen.createMany({
            data: input.allergenIds.map((allergenId) => ({ employeeId: id, allergenId })),
            skipDuplicates: true,
          });
        }
      }
      if (input.dietaryTagIds !== undefined) {
        await tx.employeeDietaryTag.deleteMany({ where: { employeeId: id } });
        if (input.dietaryTagIds.length > 0) {
          await tx.employeeDietaryTag.createMany({
            data: input.dietaryTagIds.map((tagId) => ({ employeeId: id, tagId })),
            skipDuplicates: true,
          });
        }
      }
    });
    logAction(this.logger, 'employee.update', { employeeId: id });
    return { id };
  }

  async setEmployeeActive(id: string, isActive: boolean): Promise<{ id: string }> {
    await this.requireEmployee(id);
    if (!isActive) {
      await this.assertNotOwner(id);
    }
    await this.prisma.employee.update({ where: { id }, data: { isActive } });
    logAction(this.logger, isActive ? 'employee.activate' : 'employee.deactivate', {
      employeeId: id,
    });
    return { id };
  }

  async importCsv(companyId: string, text: string): Promise<CsvImportResult> {
    await this.requireCompany(companyId);
    let parsed;
    try {
      parsed = parseCsv(text);
    } catch {
      throw new DomainError({
        code: 'VALIDATION_ERROR',
        message: 'CSV could not be parsed',
        httpStatus: 400,
      });
    }
    const header = parsed.header.map((cell) => cell.toLowerCase());
    if (header.length !== 2 || header[0] !== 'name' || header[1] !== 'email') {
      throw new DomainError({
        code: 'VALIDATION_ERROR',
        message: 'CSV must have the header name,email',
        httpStatus: 400,
      });
    }
    if (parsed.rows.length > CSV_MAX_ROWS) {
      throw new DomainError({
        code: 'CSV_TOO_LARGE',
        message: 'CSV must have at most 1000 rows',
        httpStatus: 409,
      });
    }
    const existing = await this.prisma.employee.findMany({ select: { email: true } });
    const taken = new Set(existing.map((row) => row.email));
    const seen = new Set<string>();
    const valid: Array<{ name: string; email: string; line: number }> = [];
    const errors: Array<{ row: number; message: string }> = [];
    for (const record of parsed.rows) {
      const name = record.values[0] ?? '';
      const email = (record.values[1] ?? '').trim().toLowerCase();
      const result = employeeCsvRowSchema.safeParse({ name, email });
      if (!result.success) {
        errors.push({ row: record.line, message: 'Invalid name or email' });
        continue;
      }
      if (taken.has(email) || seen.has(email)) {
        errors.push({ row: record.line, message: 'Email is already used' });
        continue;
      }
      seen.add(email);
      valid.push({ name: result.data.name, email, line: record.line });
    }
    if (valid.length > 0) {
      await this.prisma.employee.createMany({
        data: valid.map((row) => ({ companyId, name: row.name, email: row.email })),
        skipDuplicates: true,
      });
    }
    logAction(this.logger, 'employee.import-csv', {
      companyId,
      imported: valid.length,
      errors: errors.length,
    });
    return { imported: valid.length, errors };
  }

  private async moveEmployee(id: string, toCompanyId: string): Promise<void> {
    await this.assertNotOwner(id);
    await this.requireCompany(toCompanyId);
    const open = await this.prisma.order.findFirst({
      where: { employeeId: id, status: { in: ['DRAFT', 'PLACED'] } },
      select: { id: true },
    });
    if (open !== null) {
      throw new DomainError({
        code: 'EMPLOYEE_MOVE_BLOCKED',
        message: 'Employee has open orders and cannot move yet',
        httpStatus: 409,
      });
    }
  }

  private async assertNotOwner(id: string): Promise<void> {
    const owned = await this.prisma.company.findFirst({
      where: { ownerEmployeeId: id },
      select: { id: true },
    });
    if (owned !== null) {
      throw new DomainError({
        code: 'OWNER_IMMUTABLE',
        message: 'Owner cannot move or deactivate until replaced',
        httpStatus: 409,
      });
    }
  }

  private async requireCompany(id: string): Promise<void> {
    const company = await this.prisma.company.findUnique({ where: { id }, select: { id: true } });
    if (company === null) {
      throw new DomainError({
        code: 'COMPANY_NOT_FOUND',
        message: 'Company not found',
        httpStatus: 404,
      });
    }
  }

  private async requireEmployee(id: string): Promise<{ id: string; companyId: string }> {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: { id: true, companyId: true },
    });
    if (employee === null) {
      throw new DomainError({
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'Employee not found',
        httpStatus: 404,
      });
    }
    return employee;
  }
}

function mapMissingReference(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
    return new DomainError({
      code: 'VALIDATION_ERROR',
      message: 'A referenced record does not exist',
      httpStatus: 400,
    });
  }
  return error;
}
