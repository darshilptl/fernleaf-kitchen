---
name: kitchen-dispatch
description: Use for the kitchen board, prep unit start/done, force-complete, planned times, late/at-risk, drops, dispatch steps, driver assignment, driver view, delivery confirmation, and on-time.
---

# Kitchen, dispatch, driver (PDF 4.7, 4.8)

## Planned times (packages/shared/kitchen-plan, derived live, never stored, D-62)

`scheduledInstant = toKitchenInstant(deliveryDate, deliveryTimeMinute)`
`plannedDispatchReady = scheduledInstant - company.dispatchLeadMinutes`
`plannedKitchenReady = plannedDispatchReady - KITCHEN_PREP_LEAD_MINUTES (30)`
`getLateness(now, plannedKitchenReady, atRiskMinutes, isDone)` -> DONE | LATE (`now > planned`) |
AT_RISK (`now >= planned - atRiskMinutes`) | ON_TRACK (D-68). Only open work is late/at-risk.

## Kitchen board

- Date picker (default `kitchenToday`). Prep unit = one `OrderLineCombination` of a CONFIRMED order on that date.
- Station = the dish's CURRENT station, else "Unassigned" (D-61). Filter by station.
- Cancelled/Rejected/Draft/Placed orders never appear. Server-side query, must stay fast at 400 orders:
  one query joining orders -> lines -> combinations -> choices, indexed by (`deliveryDate`, `status`).

## Unit transitions (concurrency-safe), one transaction each

1. `SELECT id, status FROM orders WHERE id = $orderId FOR UPDATE` (serialises everything for this order).
   Not CONFIRMED -> 409 `ORDER_NOT_CONFIRMED`. The unit must belong to the order (join), else 404.
2. START: `UPDATE order_line_combinations SET "startedAt" = $now WHERE id = $unit AND "startedAt" IS NULL`.
   0 rows -> 409 `UNIT_ALREADY_STARTED`.
3. DONE: `UPDATE ... SET "startedAt" = COALESCE("startedAt", $now), "doneAt" = $now WHERE id = $unit AND "doneAt" IS NULL`.
   0 rows -> 409 `UNIT_ALREADY_DONE`. (Finishing an unstarted unit also records the start.)
4. `UPDATE orders SET "kitchenStartedAt" = $now WHERE id = $orderId AND "kitchenStartedAt" IS NULL`
   (+ `KITCHEN_STARTED` event only if a row changed).
5. `UPDATE orders SET "kitchenReadyAt" = $now WHERE id = $orderId AND "kitchenReadyAt" IS NULL AND NOT EXISTS
(SELECT 1 FROM order_line_combinations c JOIN order_lines l ON l.id = c."lineId" WHERE l."orderId" = orders.id AND c."doneAt" IS NULL)`
   (+ `KITCHEN_READY` event only if a row changed). The row lock from step 1 is what makes the last two
   concurrent "done" clicks correct.
   Force-complete (`kitchen.force_complete`): same lock, set `startedAt`/`doneAt` where null for every unit, set the
   order timestamps, event `FORCE_COMPLETED`.

## Drops (D-69): NO Drop table

Drop key = `(companyId, addressId, deliveryDate, deliveryTimeMinute)` over CONFIRMED orders (plus DELIVERED orders
for display). `groupIntoDrops(orders)` is a pure function. Drop status = the least advanced step among members.

## Dispatch steps, applied to a WHOLE drop in one transaction

1. Lock members: `SELECT id FROM orders WHERE <drop key> AND status = 'CONFIRMED' ORDER BY id FOR UPDATE`
   (ordered locking avoids deadlocks). None -> 404 `DROP_NOT_FOUND`.
2. Pending members = those whose own step timestamp is null. None pending -> 409 `DROP_STEP_ALREADY_DONE`.
3. Every pending member must have the prerequisite: dispatch-ready needs `kitchenReadyAt`; out-for-delivery needs
   `dispatchReadyAt` AND a non-null `driverId`. Else 409 `DROP_PREVIOUS_STEP_MISSING`.
4. Set the timestamp on pending members, insert events `DISPATCH_READY` / `OUT_FOR_DELIVERY`.
   Assign driver: allowed only while no member is out for delivery (409 `DROP_ALREADY_OUT`). The driver must be
   active and hold `deliveries.assignable`. The company's default driver is only the UI default.
   Permissions: `dispatch.manage` for assign, dispatch-ready, out-for-delivery (D-70).

## Driver

- Driver list: orders where `driverId = me` AND `deliveryDate = kitchenToday` grouped into drops, ordered by
  `deliveryTimeMinute`. Visible at any stage; "Delivered" enabled only when the drop is out for delivery (D-70).
- Mark delivered (`deliveries.complete_own`): lock members `WHERE <drop key> AND driverId = me`; none -> 404.
  Pending members need `outForDeliveryAt`. Then for each: `deliveredAt = $now`, `deliveryNote`, `deliveryPhotoUrl`,
  `deliveredOnTime = ($now <= scheduledInstant)` (no grace, D-71), and `transitionOrder(CONFIRMED -> DELIVERED)`.
- Photo optional, stored as a URL (D-73). Build last. Mobile-first UI.

## Tests

Start twice -> second 409; done twice -> 409; done without start records start; ready only when all done, including
two parallel "done" calls on the last two units (real DB); only CONFIRMED works; force-complete; planned times and
lateness boundaries; drop grouping; each step needs its prerequisite and cannot repeat; out needs a driver;
another driver's drop -> 404; on-time boundary (equal = on time).
