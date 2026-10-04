import { DateTime } from 'luxon';
import type { CalendarDate } from './calendar.js';

/**
 * Kitchen clock. PDF §7 / D-43. Single owner of "today" and
 * calendar-date arithmetic; Group 3 (module 6, cut-off) extends
 * this file, never duplicates it.
 */
export const KITCHEN_TIME_ZONE = 'Asia/Kolkata';

/**
 * The date of `now` in the kitchen zone. The ONLY source of
 * "today" for business logic. DST-free zone, no ambiguity.
 */
export function kitchenToday(now: Date): CalendarDate {
  return DateTime.fromJSDate(now, { zone: 'utc' })
    .setZone(KITCHEN_TIME_ZONE)
    .toFormat('yyyy-MM-dd');
}

/** Add (or subtract) whole days to a YYYY-MM-DD date. */
export function addDays(date: CalendarDate, n: number): CalendarDate {
  const [y, m, d] = date.split('-').map(Number);
  const utc = Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + n);
  const out = new Date(utc);
  const mm = String(out.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(out.getUTCDate()).padStart(2, '0');
  return `${out.getUTCFullYear()}-${mm}-${dd}`;
}
