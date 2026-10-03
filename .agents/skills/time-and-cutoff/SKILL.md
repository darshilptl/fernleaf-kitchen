---
name: time-and-cutoff
description: Use for kitchen time zone, "today", calendar dates, settings, kitchen holidays, cut-off calculation, the lock rule, and cut-off processing schedule.
---

# Time and cut-off (PDF 4.6, 4.10, time-zone requirement)

## Constants and helpers (packages/shared/time)

`KITCHEN_TIME_ZONE = 'Asia/Kolkata'` (code constant, not a setting, D-43). `KITCHEN_PREP_LEAD_MINUTES = 30`.
Use Luxon for ALL zone conversion. No hand-written offsets.

- `CalendarDate` = `'YYYY-MM-DD'` string.
- `kitchenToday(now: Date): CalendarDate`: the date of `now` in the kitchen zone. The ONLY source of "today".
- `toKitchenInstant(date: CalendarDate, minuteOfDay: number): Date`: that local time in the kitchen zone -> UTC.
- `fromDbDate(d: Date): CalendarDate` (UTC getters) and `toDbDate(s: CalendarDate): Date` (`${s}T00:00:00.000Z`).
  These two are the only code that touches Prisma `@db.Date` values.
- `addDays`, `isoWeekday` operate on `CalendarDate`.
  Never use `new Date().toISOString().slice(0, 10)`, `getDay()`, or the browser/server zone for business dates.
  The frontend displays times in the kitchen zone and never computes "today" itself.

## Settings (single row id = 1, `PlatformSettings`)

`kitchenWorkingDays` (>= 1 day), `cutoffTimeMinute` 0-1439, `cutoffWorkingDays` >= 0, `atRiskMinutes` >= 0.
If the row is missing on boot, create it with 16:00, 2 days, Mon-Fri, 30. Kitchen holidays: plain add/remove.
Settings changes are NOT retroactive: Confirmed orders stay Confirmed.

## Algorithm: `cutoffInstant(deliveryDate, settings, kitchenHolidays)` (packages/shared/cutoff, single owner)

1. `d = deliveryDate`, `remaining = settings.cutoffWorkingDays`.
2. Loop at most 366 times (else throw `CUTOFF_CONFIG_INVALID`):
   a. if `remaining == 0` stop.
   b. `d = d - 1 day`.
   c. if `isoWeekday(d)` is in `kitchenWorkingDays` AND `d` not in `kitchenHolidays`: `remaining -= 1`.
3. Return `toKitchenInstant(d, settings.cutoffTimeMinute)`.
   The delivery date itself is never counted. Company calendar is NOT an input (PDF 4.4).
   Checks (2 days, 16:00, Mon-Fri): Wed delivery -> Mon 16:00. Monday a holiday -> Fri 16:00. Tue -> Fri 16:00.
   Sat -> Thu 16:00. Day count 0 -> delivery date at 16:00.

## Lock rule

`isLocked(deliveryDate, now) = now >= cutoffInstant(...)`. Computed live, nothing stored per order (D-46).
Edit/cancel guards use this, NOT the order status, so protection holds even if the job has not run.
Kitchen non-working day/holiday as a DELIVERY date is NOT blocked (D-45).

## Processing schedule (skill: orders has the SQL)

Run: every 60 s while the server is awake, once on startup (catch-up), and via `POST /orders/cutoff/run`
(`orders.cutoff_run`). Each run: take distinct `deliveryDate` of Draft/Placed orders, compute each cut-off,
process dates where `now >= cutoff`. Idempotent by construction (only touches Draft/Placed).
Reviewers can test without waiting by editing the cut-off setting and pressing the manual trigger.

## Tests

The five checks above exactly; identical under `TZ=UTC` and `TZ=America/Los_Angeles`; company calendar has no
effect; exactly-at-cutoff is locked, one second before is not; no working day within 366 steps throws;
delivery on a kitchen holiday still computes.
