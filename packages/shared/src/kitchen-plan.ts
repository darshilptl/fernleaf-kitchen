import type { CalendarDate } from './calendar.js';
import { toKitchenInstant } from './time.js';

/**
 * Planned kitchen/dispatch instants. PDF §4.7 / D-62.
 *
 * Single owner of the worked-back plan. Values are derived live
 * from the order's current delivery time and the company's
 * `dispatchLeadMinutes` — never stored — so the plan updates when
 * the delivery time changes.
 *
 * Algorithm:
 *   1. `scheduledInstant` = that date at `deliveryTimeMinute` kitchen time.
 *   2. `plannedDispatchReady` = scheduled minus `dispatchLeadMinutes`.
 *   3. `plannedKitchenReady` = dispatch-ready minus `KITCHEN_PREP_LEAD_MINUTES`.
 * Invariants: lead minutes are integers >= 0; output Date objects are UTC instants.
 * Edge cases: midnight-crossing subtraction stays correct (Date arithmetic).
 */

export const KITCHEN_PREP_LEAD_MINUTES = 30;

export interface PlannedInstants {
  scheduledInstant: Date;
  plannedDispatchReady: Date;
  plannedKitchenReady: Date;
}

export function plannedInstants(
  deliveryDate: CalendarDate,
  deliveryTimeMinute: number,
  dispatchLeadMinutes: number,
): PlannedInstants {
  const scheduledInstant = toKitchenInstant(deliveryDate, deliveryTimeMinute);
  const plannedDispatchReady = new Date(
    scheduledInstant.getTime() - dispatchLeadMinutes * 60_000,
  );
  const plannedKitchenReady = new Date(
    plannedDispatchReady.getTime() - KITCHEN_PREP_LEAD_MINUTES * 60_000,
  );
  return { scheduledInstant, plannedDispatchReady, plannedKitchenReady };
}

export type Lateness = 'DONE' | 'LATE' | 'AT_RISK' | 'ON_TRACK';

/**
 * Lateness of one open prep unit. PDF §4.7 / D-68.
 *
 * Only open work is late/at-risk. Done work is always DONE.
 * Boundaries: `now > planned` is LATE; `now >= planned - atRisk`
 * is AT_RISK; equality with planned counts as LATE only past it.
 */
export function getLateness(
  now: Date,
  plannedKitchenReady: Date,
  atRiskMinutes: number,
  isDone: boolean,
): Lateness {
  if (isDone) {
    return 'DONE';
  }
  const nowMs = now.getTime();
  const plannedMs = plannedKitchenReady.getTime();
  if (nowMs > plannedMs) {
    return 'LATE';
  }
  if (nowMs >= plannedMs - atRiskMinutes * 60_000) {
    return 'AT_RISK';
  }
  return 'ON_TRACK';
}
