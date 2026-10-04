import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { ROLE_SPECS } from '@repo/shared';

/**
 * Seeds and re-asserts the platform base data. D-79.
 *
 * Runs on every boot and is idempotent: roles are upserted by
 * key, permissions are synced (stale removed, missing added —
 * so a newly added key reaches Admin automatically, still
 * excluding `deliveries.assignable`), the four reviewer accounts
 * are re-asserted (password, role, active), and the settings row
 * is inserted only when missing (reviewer-edited cut-off values
 * are never overwritten).
 */

const SEED_PASSWORD = 'Test@1234';

const SEED_ACCOUNTS = [
  { email: 'admin@test.com', name: 'Admin', roleKey: 'admin' },
  { email: 'kitchen@test.com', name: 'Kitchen', roleKey: 'kitchen' },
  { email: 'dispatch@test.com', name: 'Dispatch', roleKey: 'dispatch' },
  { email: 'driver@test.com', name: 'Driver', roleKey: 'driver' },
] as const;

const DEFAULT_SETTINGS: {
  id: number;
  kitchenWorkingDays: number[];
  cutoffTimeMinute: number;
  cutoffWorkingDays: number;
  atRiskMinutes: number;
} = {
  id: 1,
  kitchenWorkingDays: [1, 2, 3, 4, 5],
  cutoffTimeMinute: 960,
  cutoffWorkingDays: 2,
  atRiskMinutes: 30,
};

export async function ensureBaseData(prisma: PrismaClient): Promise<void> {
  const roleIds = new Map<string, string>();
  for (const spec of ROLE_SPECS) {
    const role = await prisma.role.upsert({
      where: { key: spec.key },
      update: { name: spec.name, landingPath: spec.landingPath, isSystem: true },
      create: {
        key: spec.key,
        name: spec.name,
        landingPath: spec.landingPath,
        isSystem: true,
      },
    });
    roleIds.set(spec.key, role.id);

    const existing = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      select: { permission: true },
    });
    const wanted = new Set<string>(spec.permissions);
    const stale = existing
      .map((row) => row.permission)
      .filter((permission) => !wanted.has(permission));
    if (stale.length > 0) {
      await prisma.rolePermission.deleteMany({
        where: { roleId: role.id, permission: { in: stale } },
      });
    }
    const have = new Set(existing.map((row) => row.permission));
    const missing = [...wanted].filter((permission) => !have.has(permission));
    if (missing.length > 0) {
      await prisma.rolePermission.createMany({
        data: missing.map((permission) => ({ roleId: role.id, permission })),
        skipDuplicates: true,
      });
    }
  }

  await prisma.platformSettings.upsert({
    where: { id: DEFAULT_SETTINGS.id },
    update: {},
    create: { ...DEFAULT_SETTINGS },
  });

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  for (const account of SEED_ACCOUNTS) {
    const roleId = roleIds.get(account.roleKey);
    if (roleId === undefined) {
      throw new Error(`Role missing after seed: ${account.roleKey}`);
    }
    await prisma.staffUser.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        roleId,
        passwordHash,
        isActive: true,
      },
      create: {
        email: account.email,
        name: account.name,
        roleId,
        passwordHash,
        isActive: true,
      },
    });
  }
}
