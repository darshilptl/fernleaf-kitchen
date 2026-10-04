# Group 3 — Time and orders (backend + frontend). PLAN ONLY, do not implement.

PDF sections: 4.6 (orders), 4.10 (settings), 4.4 (company calendar vs cut-off), 7 (tests).
Skills read: module-workflow, time-and-cutoff, orders, pricing, companies-employees,
catalogue-and-menu, auth-permissions, ambiguity-log, testing, frontend-standards.
Decisions touched: D-29, D-46, D-50, D-51, D-54..D-60, D-65, D-72, D-75, D-77, D-79, D-80.
Truths: `docs/assignment.txt` > `apps/api/prisma/schema.prisma` (+ `*_constraints/migration.sql`)
> `docs/DECISIONS.md` > skills. Schema models already exist (no schema change):
`PlatformSettings`, `KitchenHoliday`, `Order`, `OrderLine`, `OrderLineCombination`,
`OrderCombinationChoice`, `OrderEvent`. No `orders`/`settings` modules exist yet.

## 1. Flags from review (conflicts, risks)

1. `packages/shared/src` has `time.ts`, `calendar.ts`, `pricing.ts` but NO `cutoff.ts` — it must be created (single owner per AGENTS.md §7).
2. No order/checkout schemas exist in `packages/shared/src/schemas/` — new `orders.ts`, `settings.ts` required.
3. `@nestjs/schedule` is already a dependency (`apps/api/package.json`) — no new library for the 60s job.
4. `Order.deliveryDate` is `@db.Date`; only `fromDbDate`/`toDbDate` in shared `time.ts` may touch it.
5. Money in cents everywhere; frontend never computes totals except via shared preview helper.
6. D-17 stays superseded by D-51 (view never reprices; every line-save reprices whole order).
7. D-29 (employee move blocked with Draft/Placed orders) can only be enforced now that orders exist.
8. No `react-table` (per Group 2 plan, DataTable is hand-built on shadcn Table) — orders list reuses it, no new dependency.
9. Seed part-1 is already in prod; G3 writes no seed data (G5 owns part-2). Settings row `id=1` insert-if-missing only.
10. Cut-off job touches only Draft/Placed rows; Confirmed/Delivered/Cancelled/Rejected never reopened.

## 2. Scope ([Must] only; [Should] deferred)

### Module 6 — settings + kitchen time + cut-off [Must] (PDF 4.10, 4.6)

- Settings page: `kitchenWorkingDays` (≥1 day), kitchen holidays add/remove, `cutoffTimeMinute` 0–1439,
  `cutoffWorkingDays` ≥0, `atRiskMinutes` ≥0. Single row `id=1`; missing row bootstraps Mon–Fri, 16:00, 2 days, 30.
- `cutoffInstant(deliveryDate, settings, kitchenHolidays)` + `isLocked(deliveryDate, now)` in
  `packages/shared/cutoff.ts` (single owner). Five worked checks exactly (Wed→Mon 16:00; Monday holiday→Fri;
  Tue→Fri; Sat→Thu with day-count 2/16:00/Mon–Fri; count 0→delivery date 16:00). Timezone matrix via `test:tz`.
- Lock is computed live (`now >= cutoffInstant`); nothing stored per order; guards use it, not status (D-46).
- Kitchen non-working day/holiday as a DELIVERY date is NOT blocked (D-45 per skill).
- Company calendar is NOT an input to cut-off (PDF 4.4).

### Module 7 — orders [Must] (PDF 4.6)

- Create flow: choose employee → delivery date → that employee's menu (MenuResolver only) →
  lines + combination builder → address/time/packaging (defaults from company; deviations need employee flags, D-59)
  → price breakdown per line + order total → save draft (may be empty, D-57) or place.
- Server validation in the skill's exact order (employee/company active → date ≥ today + unlocked →
  company delivery day → details + flags → MenuResolver per dish, no repeated dish → quantities/min-qty →
  combo sums + distinct comboKey → group/option/price rules → place requires ≥1 line, full reprice + revalidate).
- One pricing function in shared; snapshots on every save (names + prices); viewing never reprices (D-51).
- `transitionOrder()` only legal transitions (skill table); `version` conditional update, 409 on conflict;
  invoiced orders cannot cancel/reject (`invoiceId IS NULL`, D-74).
- List: server-paginated (`page`, `pageSize ≤ 100`), filters `from`/`to`/`status`/`companyId`/`invoiced`,
  search (order number, employee name/email, company name), sort delivery-date desc then order-number desc.
- Detail: lines, choices, money breakdown, delivery details, timeline (`OrderEvent`s).
- Admin overrides (D-60, D-72): cancel/reject + change time/address/packaging on Placed(locked) or Confirmed
  pre-delivery only; no line edits; time/address blocked once `dispatchReadyAt` set (earlier change clears
  `driverId`); packaging until out-for-delivery; `DETAILS_OVERRIDDEN` event with note (e.g. `Time 12:30 -> 13:00`).
- Reject requires reason, terminal, not billable (D-52).
- Cut-off processing: `ScheduleModule` every 60s + startup catch-up + `POST /orders/cutoff/run`
  (`orders.cutoff_run`); per-date transaction with the skill's `RETURNING` SQL (Draft→Cancelled, Placed→Confirmed);
  idempotent; manual trigger button for reviewers.
- Employee-move guard (D-29) enforced in `EmployeesService` once orders exist.
- Delivery date fixed after creation (D-58: cancel + recreate).

[Should] deferred: portions extras beyond flat per-size (uses existing `OptionPortion` only if schema already
supports it — no schema change), CSV anything for orders (none in PDF), delivery photo (G4).

## 3. Files (exact paths)

`packages/shared/src/`:

- `cutoff.ts` (NEW: `cutoffInstant`, `isLocked`), `cutoff.spec.ts` (NEW)
- `pricing.ts` (ADD: `comboKey`, `computeOrderTotals`), `calendar.ts` (reuse `isCompanyDeliveryDay`)
- `time.ts` (reuse `kitchenToday`, `toKitchenInstant`, `fromDbDate`, `toDbDate`)
- `schemas/orders.ts` (NEW), `schemas/settings.ts` (NEW), `errors.ts` (reuse codes + add
  `ORDER_*`, `CUTOFF_CONFIG_INVALID` only if missing)

`apps/api/src/modules/settings/` (NEW module):

- `settings.module.ts`, `settings.controller.ts`, `settings.service.ts`
- `dto/settings.schema.ts` (re-export shared), `settings.spec.ts`

`apps/api/src/modules/orders/` (NEW module):

- `orders.module.ts` (imports `ScheduleModule.forRoot()` once — if already imported in `app.module.ts`, reuse),
  `orders.controller.ts`, `orders.service.ts`, `cutoff-scheduler.ts`
- `domain/validate-order-draft.ts`, `domain/order-state-machine.ts` (`transitionOrder`)
- `dto/orders.schema.ts` (re-export shared), `orders.spec.ts`, `cutoff.spec.ts`
- `app.module.ts` (EDIT: register both modules only)

`apps/api/src/modules/employees/` (EDIT only):

- `employees.service.ts` (ADD D-29 guard), `employees.service.spec.ts` (ADD 1 test)

`apps/web/src/`:

- Routes: `app/(staff)/admin/settings/page.tsx` (NEW), `app/(staff)/admin/orders/page.tsx` (NEW),
  `app/(staff)/admin/orders/[id]/page.tsx` (NEW)
- `features/settings/settings-form.tsx`, `features/settings/holiday-list.tsx` (NEW)
- `features/orders/order-list.tsx`, `features/orders/order-builder.tsx`,
  `features/orders/combination-builder.tsx`, `features/orders/order-detail.tsx` (NEW)
- `hooks/use-settings.ts`, `hooks/use-orders.ts` (NEW)
- Reuse: `components/data-table.tsx`, `lib/api-client.ts`, `lib/nav.ts` (EDIT: 2 nav entries),
  `lib/notify.ts`, shadcn `Table/Button/Input/Select/Dialog/Sheet/Tabs/Skeleton/Calendar/Popover/Badge`
- No new dependencies.

### 3b. Frontend standards (per skill + AGENTS.md §12)

- Page header: `heading-sm` + `description-sm`, actions right; one H1 per page; content panel
  `bg-background-panel rounded-lg shadow-card p-6`; gaps 4/6/8; tokens only (never hex/arbitrary/`dark:`).
- Dense tables `text-body-sm`, headers `font-medium`, numbers/prices `tabular-nums`, status via `StatusBadge`
  (dot + `text-caption` label), row actions in dropdown, Skeleton rows, Empty + error-with-retry states.
- Forms: shared Zod → inferred type → `react-hook-form` + `zodResolver`; server `path`
  (e.g. `lines[0].combinations[1].choices`) maps via `applyServerErrors`; unmapped → toast.
- Data in hooks only (TanStack Query); no `useEffect` fetching; permission-hiding is UX only.
- Motion: none (no justified animation in this group).

## 4. Domain functions (pure; `now: Date` param; header comment with PDF § + algorithm + invariants)

- `cutoffInstant(deliveryDate: CalendarDate, settings, holidays: CalendarDate[]): Date` (shared/cutoff).
  Algorithm = skill §steps 1–3 (loop ≤366, else `CUTOFF_CONFIG_INVALID`). Invariants: delivery date never
  counted; company calendar not an input. Edge: count 0; holiday on stepped day; 366-step throw.
- `isLocked(deliveryDate, now, settings, holidays): boolean` = `now >= cutoffInstant(...)`.
  Edge: exactly-at-cutoff locked; one second before not.
- `comboKey(choices: Array<{groupId, optionId, sizeId|null}>): string` (shared/pricing) — sorted
  `groupId:optionId:sizeId` joined by `|`; `""` when no groups. Invariant: distinct combos per line (D-54).
- `computeOrderTotals(input): { lines: LineTotal[]; totalCents: number }` (shared/pricing, single arithmetic
  owner) — `unit = dish + Σ(options + portionExtra)`; `comboTotal = unit × qty`; `line = Σ combos`;
  `order = Σ lines`. No tax/fees. Integers only.
- `validateOrderDraft(input, ctx): void` (api/orders/domain) — throws `DomainError` with `{code, path}`
  in the skill's 9-step order. Pure (takes resolved menu maps + prices + `now` as data).
- `transitionOrder(tx, input)` (api/orders/domain) — conditional `updateMany` + `OrderEvent` insert in the
  same transaction; 404 vs 409 mapping per skill.

## 5. Endpoints (Zod pipe; `@RequirePermission`; error `{code, path, message}[]`)

Settings (`settings.read` / `settings.manage`):

- `GET /api/settings` → row. `PATCH /api/settings` (body: workingDays, cutoffTimeMinute, cutoffWorkingDays,
  atRiskMinutes) → row. Errors: `VALIDATION_ERROR` 400.
- `GET /api/settings/holidays` → list. `POST /api/settings/holidays` (`{date, name?}`) → row.
  `DELETE /api/settings/holidays/:id` → `{ok}`. `CUTOFF_CONFIG_INVALID` 500 only from computation.

Orders (D-65: `orders.read` list/detail; `orders.create` create/edit/place/cancel while unlocked;
`orders.override` post-cut-off cancel/reject/detail-override; `orders.cutoff_run` manual trigger):

- `POST /api/orders` (create draft; body: `employeeId`, `deliveryDate`, optional lines/details) → `{id, orderNumber}`
- `PATCH /api/orders/:id` (edit unlocked draft/placed: lines wholesale replace + details) → `{id, version}`
- `POST /api/orders/:id/place` (revalidate + reprice; from DRAFT) → `{id, version}`
- `POST /api/orders/:id/cancel` (`orders.create` if unlocked else `orders.override`; body: `{version}`) → `{id}`
- `POST /api/orders/:id/reject` (`orders.override`; body: `{version, reason}`) → `{id}`
- `PATCH /api/orders/:id/details` (`orders.override`; body: time/address/packaging + `version`) → `{id, version}`
- `GET /api/orders?page&pageSize&from&to&status&companyId&invoiced&search` → `{items, page, pageSize, total}`.
  Sort delivery-date desc, then order-number desc. `invoiced` filters `invoiceId` null/not-null.
- `GET /api/orders/:id` → order + lines + choices + money + delivery + events
- `POST /api/orders/cutoff/run` (`orders.cutoff_run`) → `{processedDates, cancelled, confirmed}`
- State errors: `ORDER_NOT_FOUND` 404; `ORDER_STATE_CONFLICT` 409; `ORDER_INVOICED` 409;
  `ORDER_LOCKED` 409 (locked edit by staff); validation codes with `path`.

## 6. Transactions, locks, concurrency

- Every multi-write in one `prisma.$transaction(async (tx) => …)`; no nesting.
- Create/edit: order + lines + combinations + choices + `CREATED`/`EDITED` event atomically; edit replaces
  lines wholesale (delete + recreate) — allowed because only unlocked orders are editable.
- `transitionOrder` conditional `updateMany` on `(id, status∈from, version?, invoiceId null?)` + event insert;
  `version` bumped on every write; mismatch → 409.
- Cut-off: one transaction per delivery date using the skill's `RETURNING` SQL; events only for updated rows;
  parallel runs safe by construction.
- Settings default swap n/a; holiday add/remove single-row writes (unique date index).

## 7. Tests (Vitest colocated; real Postgres `TEST_DATABASE_URL`; fake clock; `test:tz` under UTC + America/Los_Angeles)

Shared (`packages/shared`, pure):

- cutoff five checks exactly; exactly-at-cutoff locked / 1s-before not; company calendar no effect;
  366-step throw; `test:tz` matrix passes.
- `comboKey` ordering + empty-string case; totals: 10 bowls (6 brown + 4 jeera = 7650c) reconcile.

API (`apps/api`, services constructed directly, truncate + re-ensure settings/reference per file):

- validation order: past date / locked date / company non-delivery-day rejected; flags bind admins pre-cutoff;
  repeated dish; min-qty total; combo sum mismatch; duplicate combo; missing required group; two options one group;
  unpriced option unselectable; draft may be empty; place needs ≥1 line.
- snapshots: price change leaves order untouched; edit reprices whole order (D-51); viewing never reprices.
- dish unavailable between draft and place → place fails.
- locked blocks staff edit even before job ran; `orders.override` cancel/reject/override paths + D-72
  dispatchReady block + driver-clear rule.
- cut-off run twice = same result, no duplicate events; two simultaneous edits one `version` → one 409;
  two parallel cutoff runs → same counts.
- D-29: move employee with Draft/Placed blocked; with Confirmed+ allowed (companyId stays).

## 8. New ambiguities with proposed D-entries (IDs D-88+; D-82..D-87 reserved by Group 2 plan, still unappended)

| ID | PDF § | Ambiguity | Decision | Why | Alternative |
|----|-------|-----------|----------|-----|-------------|
| D-88 | 4.6 | Minimum fields to create a draft | `employeeId` + `deliveryDate` required; details default from company; lines optional | Least inventive; matches "staff create an order for an employee" + D-57 | Allow dateless drafts |
| D-89 | 4.6 | Order search scope | orderNumber, employee name/email, company name | Literal skill list; covers reviewer lookup | Full-text everything |
| D-90 | 4.6 | Manual cut-off trigger scope | Processes every past-cutoff date with Draft/Placed rows, returns counts | Matches "safe to run twice" + reviewer try-it use | Single-date param |
| D-91 | 4.6 | Reject reason length | Non-empty string, ≤500 chars, required | Skill says reason required; minimal constraint | Free-form unlimited |

## 9. Gate + manual checklist (user runs)

- Gate: `pnpm check-types && pnpm lint && pnpm test` (+ `pnpm test:tz`), `pnpm --filter api prisma validate`;
  zero warnings; no `any`, no `!`, exhaustive switches.
- Manual: settings edit + holiday add persists; create draft empty → add bowls with valid combos → totals match
  skill example; place → locked date rejects staff edit; admin override time clears driver pre-dispatchReady,
  blocked post-dispatchReady; manual cut-off button confirms past-date placed→confirmed, draft→cancelled;
  list filters/search/pagination + detail timeline render; employee move blocked with open order.

## 10. Audit traceability (AUDIT pass 1 — 2026-10-05; zero contradictions, zero unlabeled unsupported)

| Plan item | PDF § (≤15 words) + skill/D | Verdict |
|-----------|-----------------------------|---------|
| Settings page fields + bootstrap | 4.10 "cut-off time and day count" + time-and-cutoff/settings | OK |
| `cutoffInstant`/`isLocked` in shared/cutoff | Single owner AGENTS §7 + time-and-cutoff algorithm | OK |
| Five worked checks + tz matrix | Skill checks; `test:tz` per testing | OK |
| Lock computed live, nothing stored | "lock at a configured time" + D-46 | OK |
| Company calendar excluded from cut-off | 4.4 "company calendar does not move" | OK |
| Delivery on kitchen holiday not blocked | Skill D-45 | OK |
| Create flow (employee/date/menu/lines/details/totals/place) | 4.6 "The flow:" six lines | OK |
| Draft may be empty; date fixed | D-57; D-58 | OK |
| 9-step server validation + flags bind all | 4.6 "validated on the server" + D-50..D-59 | OK |
| No repeated dish; combo sum + distinct key | D-54; orders skill | OK |
| One shared pricing fn + snapshots; view never reprices | AGENTS §7 + D-51 | OK |
| `transitionOrder`, version 409, invoiced block | Skill table + D-74 | OK |
| List filters/search/pagination/sort | 4.6 "filtered at least by" + skill sort | OK |
| Detail lines/choices/money/delivery/timeline | 4.6 "detail page shows" | OK |
| Overrides + dispatchReady/driver rules | 4.6 "Admins can change" + D-60/D-72 | OK |
| Reject reason, terminal, not billable | D-52 | OK |
| Cut-off job 60s + startup + manual trigger | 4.6 "trigger it manually" + time-and-cutoff | OK |
| Idempotent RETURNING SQL, twice + parallel tests | 4.6 "twice must be safe" + testing | OK |
| D-29 move guard; D-17 superseded | Prompt + D-29/D-51 | OK |
| Combination builder design proposal | Prompt hardest-screen requirement | OK |
| UI §12 + logging §13 | Prompt requirement | OK |
| D-88..D-91 proposed, D-82..87 untouched | ambiguity-log; DECISIONS highest D-80 | OK |
| Beyond the PDF | none — all items trace to Must/skill/schema | OK |

Audit iterations: 1. Changes made: added list sort order (§5) to match the orders skill;
no contradictions found; permission keys verified against `permissions.ts`
(`settings.read/manage`, `orders.read/create/override/cutoff_run` all exist);
schema fields verified (`PlatformSettings`, `KitchenHoliday`, `Order` + lines/combos/choices/events);
money in cents, time via shared helpers, no role-name checks.
