import { describe, expect, it } from 'vitest';
import { formatMoney, parseMoney } from './money.js';
import { ceilToFiveCents, parseMultiplier } from './pricing.js';
import { parseCsv } from './csv.js';
import {
  isCompanyDeliveryDay,
  isPublicDomain,
  isoWeekday,
  normalizeDomain,
} from './calendar.js';
import { PERMISSIONS, ROLE_SPECS } from './permissions.js';
import { loginSchema } from './schemas/auth.js';
import { sessionSchema } from './schemas/session.js';
import { createStaffSchema } from './schemas/staff.js';

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

describe('shared pricing math', () => {
  it('rounds cost times multiplier up to five cents', () => {
    expect(ceilToFiveCents(310, 24000)).toBe(745);
    expect(ceilToFiveCents(184, 11500)).toBe(215);
  });

  it('leaves exact multiples of five unchanged', () => {
    expect(ceilToFiveCents(200, 10000)).toBe(200);
    expect(ceilToFiveCents(0, 24000)).toBe(0);
  });

  it('parses cost multipliers and percent uplifts without floats', () => {
    expect(parseMultiplier('2.4')).toBe(24000);
    expect(parseMultiplier('+15%')).toBe(11500);
    expect(parseMultiplier('1')).toBe(10000);
    expect(() => parseMultiplier('abc')).toThrow();
    expect(() => parseMultiplier('1.23456')).toThrow();
  });
});

describe('shared company calendar', () => {  it('computes ISO weekdays with Monday as one', () => {
    expect(isoWeekday('2026-10-05')).toBe(1);
    expect(isoWeekday('2026-10-04')).toBe(7);
  });

  it('accepts working non-holiday days only', () => {
    expect(isCompanyDeliveryDay([1, 2, 3, 4, 5], [], '2026-10-06')).toBe(true);
    expect(isCompanyDeliveryDay([1, 2, 3, 4, 5], [], '2026-10-04')).toBe(false);
    expect(isCompanyDeliveryDay([1, 2, 3, 4, 5], ['2026-10-06'], '2026-10-06')).toBe(false);
  });

  it('normalizes domains and blocks public ones', () => {
    expect(normalizeDomain('  @Acme.IN  ')).toBe('acme.in');
    expect(isPublicDomain('gmail.com')).toBe(true);
    expect(isPublicDomain('acme.in')).toBe(false);
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

describe('shared CSV parser', () => {
  it('parses header and rows with line numbers', () => {
    const parsed = parseCsv('name,email\nAnn,ann@acme.in\nBob,bob@acme.in\n');
    expect(parsed.header).toEqual(['name', 'email']);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toEqual({ line: 2, values: ['Ann', 'ann@acme.in'] });
  });

  it('handles quoted commas and skips blank lines', () => {
    const parsed = parseCsv('name,email\n\n"Doe, Ann",ann@acme.in\n');
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.values[0]).toBe('Doe, Ann');
  });

  it('rejects empty input and unbalanced quotes', () => {
    expect(() => parseCsv('')).toThrow();
    expect(() => parseCsv('name,email\n"oops,ann@acme.in\n')).toThrow();
  });
});

describe('shared staff contract', () => {
  it('requires an 8-character minimum password', () => {
    const base = { name: 'N', email: 'n@acme.in', roleId: '00000000-0000-0000-0000-000000000000' };
    expect(createStaffSchema.safeParse({ ...base, password: 'short' }).success).toBe(false);
    expect(createStaffSchema.safeParse({ ...base, password: 'Test@1234' }).success).toBe(true);
  });

  it('lowercases staff emails', () => {
    const parsed = createStaffSchema.parse({
      name: 'N',
      email: 'N@Acme.IN',
      roleId: '00000000-0000-0000-0000-000000000000',
      password: 'Test@1234',
    });
    expect(parsed.email).toBe('n@acme.in');
  });
});
