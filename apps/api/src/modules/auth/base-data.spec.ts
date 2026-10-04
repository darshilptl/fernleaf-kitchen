import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { DomainError, ROLE_SPECS } from '@repo/shared';
import { PrismaService } from '../../database/prisma.service.js';
import { requireTestDatabaseUrl, truncateAll } from '../../../test/db.js';
import { AuthService } from './auth.service.js';
import { ensureBaseData } from './base-data.js';

const TEST_JWT_SECRET = 'test-secret';

describe('ensureBaseData', () => {
  const prisma = new PrismaService(requireTestDatabaseUrl());
  const auth = new AuthService(prisma, new JwtService({ secret: TEST_JWT_SECRET }));

  beforeEach(async () => {
    await truncateAll(prisma);
    await ensureBaseData(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates exactly the four accounts, each logs in with Test@1234, each holds only its role permission set, and a second run changes nothing', async () => {
    const accounts = [
      { email: 'admin@test.com', roleKey: 'admin' },
      { email: 'kitchen@test.com', roleKey: 'kitchen' },
      { email: 'dispatch@test.com', roleKey: 'dispatch' },
      { email: 'driver@test.com', roleKey: 'driver' },
    ] as const;

    expect(await prisma.staffUser.count()).toBe(4);
    expect(await prisma.role.count()).toBe(4);

    for (const account of accounts) {
      const { me } = await auth.login(account.email, 'Test@1234');
      const spec = ROLE_SPECS.find((role) => role.key === account.roleKey);
      expect(spec).toBeDefined();
      expect(new Set(me.permissions)).toEqual(new Set(spec?.permissions ?? []));
      expect(me.landingPath).toBe(spec?.landingPath);
      expect(me.roleName).toBe(spec?.name);
    }

    const staffBefore = await prisma.staffUser.count();
    const permsBefore = await prisma.rolePermission.count();
    await ensureBaseData(prisma);
    expect(await prisma.staffUser.count()).toBe(staffBefore);
    expect(await prisma.rolePermission.count()).toBe(permsBefore);
  });

  it('rejects unknown email and wrong password with the same code and message', async () => {
    const failures: Array<{ code: string; message: string }> = [];
    for (const attempt of [
      { email: 'nobody@test.com', password: 'Test@1234' },
      { email: 'admin@test.com', password: 'Wrong@1234' },
    ]) {
      try {
        await auth.login(attempt.email, attempt.password);
        expect.unreachable('login must fail');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainError);
        const domain = error as DomainError;
        failures.push({ code: domain.code, message: domain.message });
      }
    }
    expect(failures).toHaveLength(2);
    expect(failures[0]).toEqual(failures[1]);
    expect(failures[0]?.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('refuses an inactive user even with the correct password', async () => {
    await prisma.staffUser.update({
      where: { email: 'driver@test.com' },
      data: { isActive: false },
    });
    await expect(auth.login('driver@test.com', 'Test@1234')).rejects.toMatchObject({
      code: 'AUTH_INACTIVE',
    });
  });

  it('lowercases the email before lookup', async () => {
    const { me } = await auth.login('ADMIN@TEST.COM', 'Test@1234');
    expect(me.email).toBe('admin@test.com');
  });

  it('restores a removed admin key on reseed but never grants deliveries.assignable', async () => {
    const admin = await prisma.role.findUniqueOrThrow({ where: { key: 'admin' } });
    await prisma.rolePermission.deleteMany({
      where: { roleId: admin.id, permission: 'billing.manage' },
    });
    await ensureBaseData(prisma);
    const rows = await prisma.rolePermission.findMany({ where: { roleId: admin.id } });
    const keys = rows.map((row) => row.permission);
    expect(keys).toContain('billing.manage');
    expect(keys).not.toContain('deliveries.assignable');
  });
});
