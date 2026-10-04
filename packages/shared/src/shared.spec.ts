import { describe, expect, it } from 'vitest';
import { formatMoney, parseMoney } from './money.js';
import { PERMISSIONS, ROLE_SPECS } from './permissions.js';
import { loginSchema } from './schemas/auth.js';
import { sessionSchema } from './schemas/session.js';

describe('shared money helpers', () => {
  it('parses dollars strings to integer cents without floats', () => {
    expect(parseMoney('7.45')).toBe(745);
    expect(parseMoney('7')).toBe(700);
    expect(parseMoney('7.4')).toBe(740);
  });

  it('formats cents as dollars with two decimals', () => {
    expect(formatMoney(745)).toBe('$7.45');
    expect(formatMoney(0)).toBe('$0.00');
  });
});

describe('shared auth contract', () => {
  it('trims and lowercases the login email', () => {
    const parsed = loginSchema.parse({
      email: '  Admin@Test.COM ',
      password: 'x',
    });
    expect(parsed.email).toBe('admin@test.com');
  });

  it('holds every permission key the auth skill requires', () => {
    for (const key of [
      'orders.create',
      'orders.override',
      'orders.cutoff_run',
      'kitchen.work',
      'dispatch.manage',
      'deliveries.assignable',
      'staff.manage',
    ]) {
      expect(PERMISSIONS).toContain(key);
    }
  });

  it('grants Admin every key except deliveries.assignable', () => {
    const admin = ROLE_SPECS.find((role) => role.key === 'admin');
    expect(admin).toBeDefined();
    expect(admin?.permissions).toContain('staff.manage');
    expect(admin?.permissions).not.toContain('deliveries.assignable');
    expect(admin?.permissions).toHaveLength(PERMISSIONS.length - 1);
  });

  it('accepts a complete session payload and rejects a malformed one', () => {
    const valid = {
      id: 'u1',
      name: 'Admin',
      email: 'admin@test.com',
      roleName: 'Admin',
      permissions: ['orders.read'],
      landingPath: '/admin/dashboard',
    };
    expect(sessionSchema.safeParse(valid).success).toBe(true);
    expect(sessionSchema.safeParse({ ...valid, roleName: '' }).success).toBe(false);
    expect(sessionSchema.safeParse({ ...valid, permissions: 'orders.read' }).success).toBe(
      false,
    );
  });
});
