import { describe, expect, it } from 'vitest';
import { getLateness, plannedInstants } from './kitchen-plan.js';
import { toKitchenInstant } from './time.js';

/**
 * Planned-time arithmetic and lateness boundaries. PDF §4.7 / D-68.
 * PDF example: delivery 12:30, lead 60 -> dispatch-ready 11:30,
 * kitchen-ready 11:00. Equal-to-planned delivery counts as on time
 * (delivery side); unit lateness uses strict `>` for LATE.
 */
describe('plannedInstants', () => {
  it('works back from the PDF example', () => {
    const plan = plannedInstants('2026-10-09', 750, 60);
    expect(plan.scheduledInstant).toEqual(toKitchenInstant('2026-10-09', 750));
    expect(plan.plannedDispatchReady).toEqual(toKitchenInstant('2026-10-09', 690));
    expect(plan.plannedKitchenReady).toEqual(toKitchenInstant('2026-10-09', 660));
  });
});

describe('getLateness', () => {
  const planned = toKitchenInstant('2026-10-09', 660);
  const at = (minute: number): Date => toKitchenInstant('2026-10-09', minute);

  it('marks done work DONE even past planned', () => {
    expect(getLateness(at(700), planned, 30, true)).toBe('DONE');
  });

  it('marks past-planned open work LATE, equality edge is AT_RISK', () => {
    expect(getLateness(at(661), planned, 30, false)).toBe('LATE');
    expect(getLateness(at(660), planned, 30, false)).toBe('AT_RISK');
  });

  it('marks the at-risk window by atRiskMinutes', () => {
    expect(getLateness(at(630), planned, 30, false)).toBe('AT_RISK');
    expect(getLateness(at(629), planned, 30, false)).toBe('ON_TRACK');
  });
});
