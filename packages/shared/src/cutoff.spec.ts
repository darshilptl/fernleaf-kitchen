import { describe, expect, it } from 'vitest';
import { cutoffInstant, isLocked } from './cutoff.js';
import type { CutoffSettings } from './cutoff.js';
import { comboKey, computeOrderTotals } from './pricing.js';
import { fromDbDate, toDbDate } from './time.js';

/**
 * Cut-off calculation and order pricing arithmetic. PDF §4.6,
 * §4.10 / skill time-and-cutoff. Runs under `test:tz` (UTC and
 * America/Los_Angeles) — assertions use UTC instants, never the
 * host zone. 2026-10-07 is a Wednesday.
 */

const SETTINGS: CutoffSettings = {
  kitchenWorkingDays: [1, 2, 3, 4, 5],
  cutoffTimeMinute: 960,
  cutoffWorkingDays: 2,
};

describe('cutoffInstant worked checks', () => {
  it('maps a Wednesday delivery to Monday 16:00 kitchen time', () => {
    // 16:00 IST = 10:30 UTC.
    expect(cutoffInstant('2026-10-07', SETTINGS, []).toISOString()).toBe(
      '2026-10-05T10:30:00.000Z',
    );
  });

  it('skips a Monday kitchen holiday back to Friday', () => {
    expect(cutoffInstant('2026-10-07', SETTINGS, ['2026-10-05']).toISOString()).toBe(
      '2026-10-02T10:30:00.000Z',
    );
  });

  it('maps a Tuesday delivery to the previous Friday', () => {
    expect(cutoffInstant('2026-10-06', SETTINGS, []).toISOString()).toBe(
      '2026-10-02T10:30:00.000Z',
    );
  });

  it('maps a Saturday delivery to Thursday', () => {
    expect(cutoffInstant('2026-10-10', SETTINGS, []).toISOString()).toBe(
      '2026-10-08T10:30:00.000Z',
    );
  });

  it('maps day count 0 to the delivery date at cut-off time', () => {
    const zero = { ...SETTINGS, cutoffWorkingDays: 0 };
    expect(cutoffInstant('2026-10-07', zero, []).toISOString()).toBe(
      '2026-10-07T10:30:00.000Z',
    );
  });
});

describe('cutoff edge cases', () => {
  it('locks exactly at the cut-off and not one second before', () => {
    const at = new Date('2026-10-05T10:30:00.000Z');
    const before = new Date('2026-10-05T10:29:59.000Z');
    expect(isLocked('2026-10-07', at, SETTINGS, [])).toBe(true);
    expect(isLocked('2026-10-07', before, SETTINGS, [])).toBe(false);
  });

  it('ignores holidays outside the count path and throws past 366 steps', () => {
    // A Sunday holiday never enters the count: Wed delivery still
    // maps to Monday. Company working days are not an input at
    // all — only the kitchen holidays list moves the instant.
    expect(cutoffInstant('2026-10-07', SETTINGS, ['2026-10-04']).toISOString()).toBe(
      '2026-10-05T10:30:00.000Z',
    );
    expect(() =>
      cutoffInstant('2026-10-07', { ...SETTINGS, kitchenWorkingDays: [] }, []),
    ).toThrow(/CUTOFF_CONFIG_INVALID/);
  });

  it('round-trips db dates without timezone drift', () => {
    expect(fromDbDate(toDbDate('2026-10-07'))).toBe('2026-10-07');
  });
});

describe('combo key and order totals', () => {
  it('builds a canonical sorted combo key', () => {
    expect(
      comboKey([
        { groupId: 'g2', optionId: 'o2', sizeId: null },
        { groupId: 'g1', optionId: 'o1', sizeId: 's1' },
      ]),
    ).toBe('g1:o1:s1|g2:o2:');
    expect(comboKey([])).toBe('');
  });

  it('prices ten bowls by unit times quantity', () => {
    const brown = { optionPriceCents: 0, portionExtraCents: 0 };
    const jeera = { optionPriceCents: 50, portionExtraCents: 0 };
    const { totalCents } = computeOrderTotals([
      {
        combinations: [
          { quantity: 6, dishPriceCents: 700, options: [brown] },
          { quantity: 4, dishPriceCents: 700, options: [jeera] },
        ],
      },
    ]);
    // 6 x 700 + 4 x 750 = 7200.
    expect(totalCents).toBe(7200);
  });
});
