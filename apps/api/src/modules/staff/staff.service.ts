import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DomainError } from '@repo/shared';
import type { ChangeRoleInput, CreateStaffInput } from '@repo/shared';
import { PrismaService } from '../../database/prisma.service.js';
import { logAction } from '../../common/logging/logging.interceptor.js';

/**
 * Staff account management. PDF §3 + auth-permissions skill.
 * Exactly one role per user; role keys are never compared in
 * code (seeding only). Self-deactivation is blocked; deactivating
 * anyone clears their Company.defaultDriverId rows in the same
 * transaction. Passwords minimum 8 characters (D-78).
 */
@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listStaff(page: number, pageSize: number): Promise<{
    items: Array<{
      id: string;
      name: string;
      email: string;
      roleId: string;
      roleName: string;
      isActive: boolean;
    }>;
    page: number;
    pageSize: number;
    total: number;
  }> {
    const [total, staff] = await this.prisma.$transaction([
      this.prisma.staffUser.count(),
      this.prisma.staffUser.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          roleId: true,
          isActive: true,
          role: { select: { name: true } },
        },
        orderBy: { email: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: staff.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        roleId: row.roleId,
        roleName: row.role.name,
        isActive: row.isActive,
      })),
      page,
      pageSize,
      total,
    };
  }

  async listRoles(): Promise<Array<{ id: string; name: string }>> {
    const roles = await this.prisma.role.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return roles;
  }

  async createStaff(input: CreateStaffInput): Promise<{ id: string }> {
    await this.requireRole(input.roleId);
    try {
      const staff = await this.prisma.staffUser.create({
        data: {
          name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
          roleId: input.roleId,
          passwordHash: await bcrypt.hash(input.password, 10),
        },
        select: { id: true },
      });
      logAction(this.logger, 'staff.create', { staffId: staff.id });
      return staff;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError({
          code: 'STAFF_EMAIL_DUPLICATE',
          message: 'Staff email is already used',
          httpStatus: 409,
        });
      }
      throw error;
    }
  }

  async changeRole(id: string, input: ChangeRoleInput): Promise<{ id: string }> {
    await this.requireStaff(id);
    await this.requireRole(input.roleId);
    await this.prisma.staffUser.update({ where: { id }, data: { roleId: input.roleId } });
    logAction(this.logger, 'staff.change-role', { staffId: id });
    return { id };
  }

  async setStaffActive(id: string, isActive: boolean, actorId: string): Promise<{ id: string }> {
    await this.requireStaff(id);
    if (!isActive && id === actorId) {
      throw new DomainError({
        code: 'STAFF_SELF_DEACTIVATE',
        message: 'You cannot deactivate your own account',
        httpStatus: 409,
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.staffUser.update({ where: { id }, data: { isActive } });
      if (!isActive) {
        await tx.company.updateMany({ where: { defaultDriverId: id }, data: { defaultDriverId: null } });
      }
    });
    logAction(this.logger, isActive ? 'staff.activate' : 'staff.deactivate', {
      staffId: id,
      actorId,
    });
    return { id };
  }

  private async requireStaff(id: string): Promise<void> {
    const staff = await this.prisma.staffUser.findUnique({ where: { id }, select: { id: true } });
    if (staff === null) {
      throw new DomainError({
        code: 'STAFF_NOT_FOUND',
        message: 'Staff member not found',
        httpStatus: 404,
      });
    }
  }

  private async requireRole(id: string): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { id }, select: { id: true } });
    if (role === null) {
      throw new DomainError({
        code: 'STAFF_NOT_FOUND',
        message: 'Role not found',
        httpStatus: 404,
      });
    }
  }
}
