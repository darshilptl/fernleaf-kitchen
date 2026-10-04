# Group 4 — Floor (backend + frontend). PLAN ONLY, do not implement.

PDF sections: 4.7 (kitchen), 4.8 (dispatch + driver), 4.9 (billing).
Skills read: module-workflow, kitchen-dispatch, billing, orders, time-and-cutoff,
pricing, companies-employees, auth-permissions, ambiguity-log, testing, frontend-standards.
Decisions touched: D-52, D-60..D-62, D-68..D-75, D-77, D-80.
Truths: `docs/assignment.txt` > `apps/api/prisma/schema.prisma` (+ `*_constraints/migration.sql`,
notably `orders_fulfilment_chain` and range checks) > `docs/DECISIONS.md` > skills.
Schema models already exist (no schema change): `Order` kitchen/dispatch/delivery/invoice
columns, `OrderLineCombination.startedAt/doneAt`, `KitchenStation`, `Company.dispatchLeadMinutes`,
`Invoice`. No `kitchen`/`dispatch`/`billing` modules, no `kitchen-plan` shared file, no new
error codes yet. Web routes exist as guarded stubs (`kitchen/dashboard`, `dispatch/dashboard`,
`driver`); billing has no route yet.

## 1. Flags from review (conflicts, risks)

1. PDF 4.7 says "delivery time minus company's delivery minutes"; the skill reads this as
   `company.dispatchLeadMinutes` (the only minutes column the schema has). Audit adopts the
   skill reading; the wording is flagged in §10, not re-decided.
2. `orders_fulfilment_chain` CHECK enforces timestamp order (dispatchReady needs kitchenReady;
   out-for-delivery needs dispatchReady + driver; delivered needs out-for-delivery). Services
   must set prerequisites first; tests must build chain state in order (G3 specs already do).
3. No Drop table (D-69): drops are a grouping query; every dispatch/driver write locks members
   with ordered `FOR UPDATE` (deadlock-safe) inside one transaction per drop.
4. Photo (D-73: URL in object storage, optional, built last): no upload infra in scope — the
   driver sheet takes an optional photo URL string. Honest limitation, no storage library.
5. Driver picker = active staff whose role holds `deliveries.assignable` (existing
   `GET /api/staff/drivers`); Admin excluded by D-75.
6. Short delivery stays billed in full (billing skill limitation); credit notes are next steps.
7. Board speed (400 orders): one joined query indexed by (`deliveryDate`, `status`); no N+1.
8. No new dependencies (scheduler already in; no upload, no table library).

## 2. Scope ([Must] only; photo upload and credit notes deferred)

### Module 8 — kitchen [Must] (PDF 4.7)

- Board for a delivery date (default today via `kitchenToday` server-side): prep units =
  `OrderLineCombination`s of CONFIRMED orders that date, routed to the dish's CURRENT station
  else "Unassigned" (D-61); station filter; only CONFIRMED orders appear.
- Unit start/done with 409s (`UNIT_ALREADY_STARTED/DONE`); done-without-start records start too;
  order `kitchenStartedAt` on first start, `kitchenReadyAt` when every unit done (`KITCHEN_*` events
  only on change); parent order row locked first (`SELECT .. FOR UPDATE`), status must be CONFIRMED
  (`ORDER_NOT_CONFIRMED`).
- Planned times derived live, never stored (D-62): `scheduledInstant`,
  `plannedDispatchReady = scheduled − dispatchLeadMinutes`,
  `plannedKitchenReady = plannedDispatchReady − 30`; lateness via `getLateness` (D-68:
  DONE | LATE past planned | AT_RISK within `atRiskMinutes` before | ON_TRACK; open work only).
  Late/at-risk obvious: left border + word (frontend-standards).
- Force-complete whole order (`kitchen.force_complete`, event `FORCE_COMPLETED`).

### Module 9 — dispatch + driver [Must] (PDF 4.8)

- Drops = `(companyId, addressId, deliveryDate, deliveryTimeMinute)` over CONFIRMED orders
  (+ DELIVERED for display); pure `groupIntoDrops`; drop status = least advanced member step.
- Whole-drop transactions: assign driver (default = company default in UI), dispatch-ready
  (needs `kitchenReadyAt`), out-for-delivery (needs `dispatchReadyAt` + driver); prerequisites
  and no-repeat enforced (`DROP_PREVIOUS_STEP_MISSING`, `DROP_STEP_ALREADY_DONE`,
  `DROP_ALREADY_OUT` for late reassignment, `DROP_NOT_FOUND`); events per member.
- Driver view (mobile-first): own drops today ordered by time, any stage visible; delivered
  enabled only when out-for-delivery (D-70); mark delivered with optional note + photo URL
  (`deliveries.complete_own`, ownership inside the query → foreign drop 404); per-order
  `deliveredAt`, `deliveredOnTime = deliveredAt <= scheduled` no grace (D-71) via
  `transitionOrder(CONFIRMED → DELIVERED)`.

### Module 10 — billing [Must] (PDF 4.9)

- Billable = CONFIRMED/DELIVERED + uninvoiced (D-53); per-company billable list; create invoice
  (select → lock → count check `INVOICE_ORDERS_NOT_BILLABLE` → frozen total = sum → link) in one
  transaction; order on at most one invoice (single column).
- Mark paid one-way (`INVOICE_ALREADY_PAID`); remove order from UNPAID invoice (lock invoice,
  `INVOICE_PAID_IMMUTABLE`, unlink 1 row, recompute total, delete invoice when empty); paid
  immutable; invoiced cancel/reject already blocked by G3 (`ORDER_INVOICED` via requireUninvoiced);
  time/address/packaging overrides allowed (no billing effect); short delivery billed in full.
- Screens: per-company billable selector, invoices list (paid/unpaid + totals), invoice detail
  with orders. `billing.read` / `billing.manage`.

[Should]/[Could]: none in §§4.7–4.9. Deferred: photo upload infra, credit notes, portions.

## 3. Files (exact paths)

`packages/shared/src/`:

- `kitchen-plan.ts` (NEW: `plannedInstants`, `getLateness`, `Lateness` type), `kitchen-plan.spec.ts` (NEW)
- `schemas/kitchen.ts` (NEW: board query, force-complete version), `schemas/dispatch.ts`
  (NEW: drop key, assign, delivered note/photo), `schemas/billing.ts` (NEW: create invoice,
  remove order, invoice query)
- `errors.ts` (ADD: `ORDER_NOT_CONFIRMED`, `UNIT_ALREADY_STARTED`, `UNIT_ALREADY_DONE`,
  `DROP_NOT_FOUND`, `DROP_STEP_ALREADY_DONE`, `DROP_PREVIOUS_STEP_MISSING`, `DROP_ALREADY_OUT`,
  `INVOICE_ORDERS_NOT_BILLABLE`, `INVOICE_ALREADY_PAID`, `INVOICE_PAID_IMMUTABLE`)
- `index.ts` (EDIT: export new helpers + schemas)

`apps/api/src/modules/kitchen/` (NEW): `kitchen.module.ts`, `kitchen.controller.ts`,
`kitchen.service.ts`, `dto/kitchen.schema.ts`, `kitchen.spec.ts`
`apps/api/src/modules/dispatch/` (NEW): `dispatch.module.ts`, `dispatch.controller.ts`,
`dispatch.service.ts` (drops + dispatch steps), `driver.controller.ts` (own drops + delivered),
`domain/group-drops.ts` (`groupIntoDrops` pure), `dto/dispatch.schema.ts`, `dispatch.spec.ts`,
`driver.spec.ts`
`apps/api/src/modules/billing/` (NEW): `billing.module.ts`, `billing.controller.ts`,
`billing.service.ts`, `dto/billing.schema.ts`, `billing.spec.ts`
`apps/api/src/app.module.ts` (EDIT: register three modules only)

`apps/web/src/`:

- Routes (keep guards/layout, replace stub bodies): `app/(staff)/kitchen/dashboard/page.tsx`,
  `app/(staff)/dispatch/dashboard/page.tsx`, `app/(staff)/driver/page.tsx` (EDIT),
  `app/(staff)/admin/billing/page.tsx`, `app/(staff)/admin/billing/[id]/page.tsx` (NEW)
- `features/kitchen/kitchen-board.tsx`, `features/dispatch/dispatch-board.tsx`,
  `features/driver/driver-drops.tsx`, `features/billing/billable-list.tsx`,
  `features/billing/invoice-detail.tsx` (NEW)
- `hooks/use-kitchen.ts`, `hooks/use-dispatch.ts`, `hooks/use-driver.ts`,
  `hooks/use-billing.ts` (NEW)
- Reuse: `components/data-table.tsx`, `components/status-badge.tsx` (ADD lateness tones via
  existing `tone` prop — Late = destructive + `border-l-2 border-destructive`, At risk = warning),
  `lib/api-client.ts`, `lib/nav.ts` (EDIT: billing entry; kitchen/dispatch/driver entries exist —
  verify), shadcn `Table/Button/Input/Select/Dialog/Sheet/Tabs/Skeleton/Calendar/Popover/Badge`
- No new dependencies.

### 3b. Frontend standards

- Page header `heading-sm` + `description-sm`, actions right, one H1; panel
  `bg-background-panel rounded-lg shadow-card p-6`; gaps 4/6/8; tokens only.
- Kitchen units: dense rows `text-body-sm`, `tabular-nums` times, station filter above,
  Start/Done buttons per unit, force-complete behind `AlertDialog` stating the consequence.
- Driver: mobile-first single column, `h-11` touch targets, sticky bottom primary action,
  big address/time, note field + optional photo-URL field on the delivery sheet.
- Every list: Skeleton/Empty/error-retry; toasts via `lib/notify.ts`; server `path` errors via
  `applyServerErrors` where forms exist.
- Motion: none.

## 4. Domain functions (pure; `now: Date` param; header comment)

- `plannedInstants(deliveryDate, deliveryTimeMinute, dispatchLeadMinutes)` (shared/kitchen-plan)
  → `{ scheduledInstant, plannedDispatchReady, plannedKitchenReady }` via `toKitchenInstant`
  and minute subtraction. Invariants: derived live, never stored (D-62); plan updates when the
  order time changes because nothing is persisted.
- `getLateness(now, plannedKitchenReady, atRiskMinutes, isDone)` (shared/kitchen-plan) →
  `'DONE' | 'LATE' | 'AT_RISK' | 'ON_TRACK'` (D-68; only open work late/at-risk; boundary:
  `now > planned` late, `now >= planned − atRisk` at-risk).
- `groupIntoDrops(orders)` (api/dispatch/domain) — pure grouping by
  `(companyId, addressId, deliveryDate, deliveryTimeMinute)`; drop status = least advanced step.
- `transitionOrder` (reuse, G3): kitchen/dispatch/delivery steps that change status
  (DELIVERED only); all other steps are conditional timestamp updates + events, never status.

## 5. Endpoints (Zod pipe; `@RequirePermission`; `{code, path, message}[]`)

Kitchen (`kitchen.read` board; `kitchen.work` start/done; `kitchen.force_complete`):

- `GET /api/kitchen/board?date&station` → units with dish/station/order/times/lateness.
- `POST /api/kitchen/units/:id/start`, `POST /api/kitchen/units/:id/done` → `{id}`.
  Errors: `ORDER_NOT_CONFIRMED` 409; `UNIT_ALREADY_STARTED/DONE` 409; unknown unit 404.
- `POST /api/kitchen/orders/:id/force-complete` (body `{version}`) → `{id, version}`.

Dispatch (`dispatch.read` board; `dispatch.manage` steps; D-70):

- `GET /api/dispatch/drops?date` → drops with members + drop status.
- `POST /api/dispatch/drops/assign` (drop key + `driverId`, `{version}` per member? No — drop
  has no version: conditional on step timestamps, 409 when already out) → `{updated}`.
- `POST /api/dispatch/drops/dispatch-ready`, `POST /api/dispatch/drops/out-for-delivery`
  (drop key) → `{updated}`. Errors: `DROP_NOT_FOUND` 404; `DROP_STEP_ALREADY_DONE`,
  `DROP_PREVIOUS_STEP_MISSING`, `DROP_ALREADY_OUT` 409; ineligible driver 409.

Driver (`deliveries.read_own` list; `deliveries.complete_own` deliver):

- `GET /api/deliveries/today` → own drops today ordered by time (any stage).
- `POST /api/deliveries/drops/delivered` (drop key + `note?`, `photoUrl?`) → `{updated}`.
  Ownership inside the query (foreign drop → 404); needs out-for-delivery; sets per-order
  `deliveredAt/note/photo/onTime` + `transitionOrder(CONFIRMED → DELIVERED)` + `DELIVERED` event.

Billing (`billing.read` lists; `billing.manage` writes):

- `GET /api/billing/companies/:id/billable` → uninvoiced CONFIRMED/DELIVERED orders.
- `POST /api/billing/invoices` (`{companyId, orderIds}`) → `{id, invoiceNumber, totalCents}`.
  Errors: `INVOICE_ORDERS_NOT_BILLABLE` 409.
- `GET /api/billing/invoices?companyId?&paid?` → `{items, page, pageSize, total}` (server
  pagination); `GET /api/billing/invoices/:id` → invoice + orders.
- `POST /api/billing/invoices/:id/pay` → `{id}` (`INVOICE_ALREADY_PAID` 409).
- `POST /api/billing/invoices/:id/remove-order` (`{orderId}`) → `{id, totalCents}` or
  `{deleted: true}` when empty (`INVOICE_PAID_IMMUTABLE` 409).

## 6. Transactions, locks, concurrency

- Every multi-write in one `prisma.$transaction(async (tx) => …)`; no nesting; conditional
  updates (`... AND timestamp IS NULL`, `FOR UPDATE` row locks) with 0-row → 409 mapping.
- Kitchen: parent order `FOR UPDATE` first; start/done single-row conditional writes; order
  timestamps set only when changed (event only then); last-two-units parallel done → ready once.
- Dispatch/driver: members locked ordered by id; whole-drop writes; events per updated member only.
- Billing: `FOR UPDATE` on billable rows / invoice row; frozen total always = sum of members.
- Concurrency tests (real TEST DB, `Promise.allSettled`): start twice, done twice, last-two-units
  parallel done, two invoice creates over one order, paid twice.

## 7. Tests (Vitest colocated; fake `ClockService`; `test:tz`)

Shared (`kitchen-plan.spec.ts`): planned arithmetic from the PDF example (delivery 12:30,
lead 60 → dispatch-ready 11:30, kitchen-ready 11:00); lateness boundaries (equal planned =
on time for delivery, late/at-risk edges for units); `test:tz` both zones.
API: start twice 409; done twice 409; done-without-start records start; ready only when all
done incl. parallel last-two; non-CONFIRMED 404/409; force-complete; drop grouping incl.
delivered-for-display; each step needs prerequisite + no repeat; out needs driver; foreign
driver drop 404; on-time boundary (equal = on time); invoice create (total = sum, parallel
creates → one 409); non-billable rejected; remove recalculates + deletes when empty; paid
immutable; invoiced cancel blocked; paid twice 409.

## 8. New ambiguities with proposed D-entries (IDs D-92+; D-88..D-91 appended by G3)

| ID | PDF § | Ambiguity | Decision | Why | Alternative |
|----|-------|-----------|----------|-----|-------------|
| D-92 | 4.7 | "Company's delivery minutes" for dispatch-ready | `Company.dispatchLeadMinutes` | Only minutes column the schema has | New column |
| D-93 | 4.8 | Drop query version guard for assign | Step timestamps guard, not a version | Drops have no row/version; timestamps are the guard | Drop table |
| D-94 | 4.8 | Delivery photo shape without upload infra | Optional URL string field, no upload | D-73 optional + built-last; no storage decision yet | Skip photo |
| D-95 | 4.9 | Invoice list default scope | All companies, filters `companyId?`/`paid?`, server pagination | Mirrors order list; reviewer lookup | Per-company only |

## 9. Gate + manual checklist (user runs)

- Gate: `pnpm check-types && pnpm lint && pnpm test` (+ `pnpm test:tz`), `prisma validate`.
- Manual: kitchen board date + station filter show seeded today's units; start → done flips one
  unit; last unit done sets order ready; force-complete closes an order; dispatch drop assign →
  dispatch-ready → out-for-delivery in order (skipping blocked); driver today view → delivered
  with note, on-time recorded; billing billable list → invoice total = sum → pay → immutable;
  remove order from unpaid recalculates; paid invoice rejects removal.

## 10. Audit traceability (AUDIT pass 1 — 2026-10-05; zero contradictions, zero unlabeled unsupported)

| Plan item | PDF § (≤15 words) + skill/D | Verdict |
|-----------|-----------------------------|---------|
| Board date/units/station/Unassigned | 4.7 "broken into prep units" + D-61 | OK |
| CONFIRMED-only, no double start/done | 4.7 "Only confirmed" + "can't twice" | OK |
| Unstarted done records start | 4.7 "Finishing never started allowed" | OK |
| Started/ready derivation + events on change | 4.7 "first start / every done" | OK |
| Planned arithmetic + live update | 4.7 "worked back" + D-62 | OK |
| Late/at-risk obvious | 4.7 "late/at-risk obvious" + D-68 | OK |
| Force-complete + event | 4.7 "force-complete whole order" | OK |
| Step chain + no repeat + driver for out | 4.8 "Each step requires previous" | OK |
| Drop key + handled together | 4.8 "same company + address + time" + D-69 | OK |
| Driver default + glanceable status | 4.8 "default = company default" + D-70 | OK |
| Own drops today, time order, note + photo | 4.8 "only own drops" + D-73 | OK |
| On-time record, no grace | D-71 | OK |
| Billable list + group + pay | 4.9 "not yet invoiced, group, paid" + D-53 | OK |
| One invoice per order | 4.9 "at most one invoice" + D-74 | OK |
| Invoiced-change decision documented | 4.9 "Decide + document" + D-74 | OK |
| D-92..D-95 proposed, numbering continues | ambiguity-log; DECISIONS highest D-91 | OK |
| "Company's delivery minutes" wording | Flagged §1, skill reading adopted | OK |
| Beyond the PDF | none — photo URL is D-73 minimal; all else Must/skill/schema | OK |

Audit iterations: 1. Changes made: none to plan items (wording flag §1 recorded, not
re-decided); permission keys verified against `permissions.ts` (`kitchen.read/work/
force_complete`, `dispatch.read/manage`, `deliveries.read_own/complete_own/assignable`,
`billing.read/manage` all exist); schema columns verified (station, lead minutes, order
timestamps, invoice columns); money in cents, time via shared helpers, no role-name checks.
