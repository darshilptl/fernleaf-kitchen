import { isoWeekday } from './calendar.js';
import type { CalendarDate } from './calendar.js';
import { addDays, toKitchenInstant } from './time.js';

/**
 * Cut-off instant and lock check. PDF §4.6 / skill time-and-cutoff.
 *
 * Single owner of both: the server and the tests call only these.
 * The delivery date itself is never counted; the company calendar
 * is NOT an input (only the kitchen calendar moves the cut-off).
 */
export interface CutoffSettings {
  kitchenWorkingDays: readonly number[];
  cutoffTimeMinute: number;
  cutoffWorkingDays: number;
}

const MAX_STEPS = 366;

/**
 * Count `cutoffWorkingDays` kitchen working days back from (not
 * including) the delivery date and return that day at
 * `cutoffTimeMinute` kitchen time as a UTC instant.
 *
 * Checks (2 days, 16:00, Mon-Fri): Wed -> Mon 16:00; Monday a
 * holiday -> Fri 16:00; Tue -> Fri 16:00; Sat -> Thu 16:00;
 * day count 0 -> delivery date at 16:00.
 *
 * Algorithm:
 *   1. Step back one day at a time (at most 366 steps).
 *   2. Count days that are kitchen working days and not holidays.
 *   3. Stop when the count is reached; convert to a kitchen instant.
 * Invariants: `holidays` entries are CalendarDates; the delivery
 * date itself never counts.
 * Edge cases: count 0 returns the delivery date at cut-off time;
 * no working day within 366 steps throws a plain Error whose
 * message starts with CUTOFF_CONFIG_INVALID (the service maps it
 * to a DomainError with that code).
 */
export function cutoffInstant(
  deliveryDate: CalendarDate,
  settings: CutoffSettings,
  holidays: readonly CalendarDate[],
): Date {
  let day = deliveryDate;
  let remaining = settings.cutoffWorkingDays;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (remaining === 0) {
      break;
    }
    day = addDays(day, -1);
    if (settings.kitchenWorkingDays.includes(isoWeekday(day)) && !holidays.includes(day)) {
      remaining -= 1;
    }
    if (step === MAX_STEPS - 1 && remaining > 0) {
      throw new Error('CUTOFF_CONFIG_INVALID: no kitchen working day within 366 steps');
    }
  }
  return toKitchenInstant(day, settings.cutoffTimeMinute);
}

/**
 * An order for `deliveryDate` is locked once `now` reaches its
 * cut-off instant. Computed live; nothing is stored (D-46).
 * Exactly at the cut-off is locked; one second before is not.
 */
export function isLocked(
  deliveryDate: CalendarDate,
  now: Date,
  settings: CutoffSettings,
  holidays: readonly CalendarDate[],
): boolean {
  return now.getTime() >= cutoffInstant(deliveryDate, settings, holidays).getTime();
}
