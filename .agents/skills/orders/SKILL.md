---
name: orders
description: Use for orders, lines, combinations, snapshots, validation order, state machine, transitionOrder, edits, admin overrides, cut-off processing SQL, list endpoint, and concurrency (version).
---

# Orders (PDF 4.1, 4.6)

## Ownership of writes

Only `OrdersService` writes orders/lines/events. Only `transitionOrder()` changes `status`.
The client sends choices and quantities ONLY. The server resolves names and prices (never trust client prices).

## State machine (the only legal transitions)

| From                                                                                                              | To        | Who / when                                                        |
| ----------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------- |
| DRAFT                                                                                                             | PLACED    | `orders.create`, not locked, after full re-validation             |
| DRAFT                                                                                                             | CANCELLED | `orders.create` not locked, or the cut-off job                    |
| PLACED                                                                                                            | CANCELLED | `orders.create` not locked. Locked -> `orders.override` only      |
| PLACED                                                                                                            | CONFIRMED | cut-off job only                                                  |
| PLACED, CONFIRMED                                                                                                 | REJECTED  | `orders.override`, reason required, terminal, not billable (D-52) |
| CONFIRMED                                                                                                         | CANCELLED | `orders.override` only                                            |
| CONFIRMED                                                                                                         | DELIVERED | delivery step (kitchen-dispatch skill)                            |
| DELIVERED, CANCELLED, REJECTED are terminal. CANCELLED/REJECTED also require `invoiceId IS NULL` (billing skill). |

## `transitionOrder(tx, input)` (single owner)

Input: `{ orderId, from: OrderStatus[], to, expectedVersion?, requireUninvoiced?, actorId | null, event, note?, data? }`.

1. `tx.order.updateMany({ where: { id, status: { in: from }, ...(expectedVersion !== undefined && { version: expectedVersion }), ...(requireUninvoiced && { invoiceId: null }) }, data: { status: to, version: { increment: 1 }, ...data } })`.
2. `count === 0` -> load the order: missing -> 404 `ORDER_NOT_FOUND`; else 409 `ORDER_STATE_CONFLICT`
   (invoiced -> 409 `ORDER_INVOICED`).
3. Insert the `OrderEvent` in the same transaction.
   Every other write (edit lines, overrides) also checks `version`, bumps it, and writes its event. Mismatch -> 409.

## Validation order (create, edit, place), all server-side

1. Employee and company active.
2. `deliveryDate >= kitchenToday(now)` AND not locked (D-50: new orders after cut-off are rejected for everyone).
3. `isCompanyDeliveryDay(company, deliveryDate)`.
4. Delivery details: address belongs to the company and is active; time 0-1439; packaging active. Any value that
   differs from the company default requires the employee's flag (D-59). Binds everyone incl. admins before cut-off.
5. Each dish passes `MenuResolver` for that employee. No repeated dish in an order (D-54).
6. Line `quantity >= 1` and `>= dish.minOrderQuantity` when set (total across combinations, D-56).
7. Combination quantities sum EXACTLY to the line quantity. No two combinations in a line have the same `comboKey`.
8. Each combination: exactly one option for every required group, at most one for an optional group, no option
   outside the dish's groups, each option active AND priced on the tier; portion groups need a size supported by
   the option, non-portion groups must have none.
9. Place only: at least one line; reprice and revalidate everything.
   Drafts may be empty; any saved line must be valid (D-57). Delivery date is fixed after creation (D-58).
   Errors: `{ code, path, message }`, e.g. `path: "lines[0].combinations[1].choices"`.

## Pricing and totals (packages/shared/pricing, single owner of the arithmetic)

`unitPriceCents = dishPriceCents + sum(optionPriceCents + portionExtraCents)`, `totalCents = unitPriceCents * quantity`,
`lineTotalCents = sum(combination totals)`, `order.totalCents = sum(line totals)`. No tax, no fees.
`comboKey` = sorted `groupId:optionId:sizeId` joined by `|` (empty string when the dish has no groups). A dish with no
groups still has exactly one combination.
Snapshot on every save: dish name/price, group name, option name/price, portion size name/extra.
Every save of lines reprices the WHOLE order; viewing NEVER reprices (D-51). Lines are replaced wholesale on edit
(delete and recreate inside the transaction), allowed because only unlocked orders are editable.
A test asserts stored totals equal recomputed totals.

## Admin override after cut-off (D-60, D-72)

Allowed: cancel, reject, and change time/address/packaging on Placed(locked) or Confirmed orders not yet delivered.
NOT allowed: editing lines or quantities. Time/address override is blocked once `dispatchReadyAt` is set and
clears `driverId` when applied earlier. Packaging override allowed until out for delivery. Address must belong to the
order's company. Event `DETAILS_OVERRIDDEN` with a note like `Time 12:30 -> 13:00`.

## Cut-off processing (single transaction per delivery date, idempotent)

```sql
WITH changed AS (
  UPDATE orders SET status = 'CANCELLED', version = version + 1, "updatedAt" = now()
  WHERE "deliveryDate" = $1 AND status = 'DRAFT' RETURNING id)
INSERT INTO order_events (id, "orderId", type, "actorId", note, "createdAt")
SELECT gen_random_uuid(), id, 'CANCELLED'::"OrderEventType", NULL, 'Cut-off passed', now() FROM changed;

WITH changed AS (
  UPDATE orders SET status = 'CONFIRMED', version = version + 1, "updatedAt" = now()
  WHERE "deliveryDate" = $1 AND status = 'PLACED' RETURNING id)
INSERT INTO order_events (id, "orderId", type, "actorId", note, "createdAt")
SELECT gen_random_uuid(), id, 'CONFIRMED'::"OrderEventType", NULL, 'Cut-off passed', now() FROM changed;
```

Events are created only for rows actually updated (RETURNING), so concurrent runs cannot duplicate events.

## List endpoint

Server-paginated (`page`, `pageSize <= 100`). Filters: `from`, `to` (delivery date), `status`, `companyId`,
`invoiced` (`invoiceId` null or not null). Search: order number, employee name/email, company name.
Sort: delivery date desc, then order number desc. Detail returns lines, choices, money breakdown, delivery details,
events (timeline).

## Permissions (D-65)

`orders.read` list/detail. `orders.create` create/edit/place/cancel while unlocked. `orders.override` post-cut-off
cancel, reject, detail overrides. `orders.cutoff_run` manual trigger. No new keys.

## Tests (required)

10 bowls (6 brown + 4 jeera = 7650 cents); sum mismatch; duplicate combination; missing required group; two options in
one group; portions; totals reconcile; price change leaves an order untouched and an edit reprices; employee flags;
past date / locked date / company holiday / non-working day rejected; locked blocks staff even before the job ran;
cut-off run twice = same result, no duplicate events; two simultaneous edits with one `version` -> one 409;
dish became unavailable between draft and place -> place fails.
