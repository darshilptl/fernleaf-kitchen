import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service.js';
import { requireTestDatabaseUrl, truncateAll } from '../../../test/db.js';
import { ensureBaseData } from '../auth/base-data.js';
import { StaffService } from './staff.service.js';

/**
 * Staff account lifecycle. PDF §3 + D-78, D-79.
 * Roles come from the real `ensureBaseData` seed.
 */
describe('StaffService', () => {
  const prisma = new PrismaService(requireTestDatabaseUrl());
  const staff = new StaffService(prisma);

  beforeEach(async () => {
    await truncateAll(prisma);
    await ensureBaseData(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function roleId(key: string): Promise<string> {
    const role = await prisma.role.findUniqueOrThrow({ where: { key } });
    return role.id;
  }

  it('creates staff with a hashed password and rejects duplicate emails', async () => {
    const kitchen = await roleId('kitchen');
    const created = await staff.createStaff({
      name: 'K2',
      email: 'K2@acme.in',
      roleId: kitchen,
      password: 'Test@1234',
    });
    const row = await prisma.staffUser.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.email).toBe('k2@acme.in');
    expect(await bcrypt.compare('Test@1234', row.passwordHash)).toBe(true);
    await expect(
      staff.createStaff({ name: 'K3', email: 'k2@ACME.in', roleId: kitchen, password: 'Test@1234' }),
    ).rejects.toMatchObject({ code: 'STAFF_EMAIL_DUPLICATE' });
  });

  it('changes roles and lists staff without password hashes', async () => {
    const created = await staff.createStaff({
      name: 'D2',
      email: 'd2@acme.in',
      roleId: await roleId('driver'),
      password: 'Test@1234',
    });
    await staff.changeRole(created.id, { roleId: await roleId('dispatch') });
    const page = await staff.listStaff(1, 20);
    const row = page.items.find((item) => item.id === created.id);
    expect(row?.roleName).toBe('Dispatch');
    expect(row).not.toHaveProperty('passwordHash');
    expect(page.total).toBeGreaterThan(0);
  });

  it('blocks self-deactivation with STAFF_SELF_DEACTIVATE', async () => {
    const admin = await prisma.staffUser.findUniqueOrThrow({ where: { email: 'admin@test.com' } });
    await expect(staff.setStaffActive(admin.id, false, admin.id)).rejects.toMatchObject({
      code: 'STAFF_SELF_DEACTIVATE',
    });
  });

  it('rejects a role change to an unknown role with STAFF_NOT_FOUND', async () => {
    const created = await staff.createStaff({
      name: 'D4',
      email: 'd4@acme.in',
      roleId: await roleId('driver'),
      password: 'Test@1234',
    });
    await expect(
      staff.changeRole(created.id, { roleId: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toMatchObject({ code: 'STAFF_NOT_FOUND' });
  });

  it('clears default-driver rows when deactivating someone else', async () => {
    const driver = await staff.createStaff({
      name: 'D3',
      email: 'd3@acme.in',
      roleId: await roleId('driver'),
      password: 'Test@1234',
    });
    const packaging = await prisma.packagingType.create({ data: { name: 'Box' } });
    const company = await prisma.company.create({
      data: {
        name: 'Acme',
        billingContactName: 'Ann',
        billingEmail: 'billing@acme.test',
        defaultDeliveryMinute: 720,
        defaultPackagingTypeId: packaging.id,
        defaultDriverId: driver.id,
        domains: { create: [{ domain: 'acme.test' }] },
        addresses: {
          create: [
            {
              label: 'HQ',
              line1: '1 Main St',
              city: 'Mumbai',
              postalCode: '400001',
              country: 'IN',
              isDefault: true,
            },
          ],
        },
      },
    });
    const admin = await prisma.staffUser.findUniqueOrThrow({ where: { email: 'admin@test.com' } });
    await staff.setStaffActive(driver.id, false, admin.id);
    const updated = await prisma.company.findUniqueOrThrow({ where: { id: company.id } });
    expect(updated.defaultDriverId).toBeNull();
  });
});
