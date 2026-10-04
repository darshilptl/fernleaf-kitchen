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

/**
 * That local kitchen time on a calendar date, as a UTC instant.
 * PDF §4.10 / D-43. The ONLY local-to-UTC constructor; DST-free
 * zone so the mapping is unambiguous. Group 6 addition.
 */
export function toKitchenInstant(date: CalendarDate, minuteOfDay: number): Date {
  return DateTime.fromFormat(date, 'yyyy-MM-dd', { zone: KITCHEN_TIME_ZONE })
    .startOf('day')
    .plus({ minutes: minuteOfDay })
    .toJSDate();
}

/**
 * Read a Prisma `@db.Date` value as a CalendarDate. UTC getters
 * only: the stored value is a dateless calendar day.
 */
export function fromDbDate(value: Date): CalendarDate {
  const mm = String(value.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(value.getUTCDate()).padStart(2, '0');
  return `${value.getUTCFullYear()}-${mm}-${dd}`;
}

/**
 * Write a CalendarDate to a Prisma `@db.Date` value. The only
 * code that constructs `@db.Date` inputs, with `fromDbDate`.
 */
export function toDbDate(date: CalendarDate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}
