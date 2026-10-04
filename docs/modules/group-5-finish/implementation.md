# Group 5 — Finish (backend + frontend). Executed directly per user order.

PDF sections: §2 (demo data), §4.11 (dashboards), §6 (prioritisation), §8 (README).
Skills read: module-workflow, seed-demo-data, dashboards, orders, billing,
kitchen-dispatch, time-and-cutoff, pricing, companies-employees, auth-permissions,
ambiguity-log, testing, frontend-standards.
Decisions touched: D-73, D-74, D-77, D-79, D-80. No new D-entries (no new
ambiguities; K/P/R placement is §6 prioritisation, documented in README).
Note: user ordered direct execution of `docs/prompts/g5-plan.md`, overriding
the plan→audit→approval wait. This file records the plan retrospectively with
the audit table; implementation matches it.

## 1. Flags from review

1. G4 agents execute concurrently in this worktree (kitchen/dispatch/billing API +
   screens, shared errors/index, app.module). G5 touches shared seams minimally:
   append-only error codes (none needed — G4 added theirs), one import line in
   `app.module.ts`, no edits to G4 module files.
2. TEST database is shared and under continuous concurrent use; any api DB spec
   can flake on cross-runner truncation (FK violations inside `ensureBaseData`).
   Evidence preserved in `/tmp/opencode/g5-*.log`.
3. `docs/modules/group-4-floor/implementation.md` has no dashboard figures —
   K/P/R figures ship as definitions served by the operational boards, not as
   duplicate endpoints (dead code is forbidden).
4. Fresh boot without part-1 data must not crash: `seedPart2` skips when no
   companies/dishes exist, and the boot call logs loudly instead of throwing.

## 2. Scope

- Module 11 (seed): `prisma/seed/part-2.ts` (`seedPart2`, D-77 marker user,
  date-relative targets, backdated creation clock, honest `runCutoff` settle,
  explicit reject/cancel, kitchen/dispatch/deliver chains, paid+unpaid invoices),
  `part-2.spec.ts` (spread + reconcile + reviewer-safety + idempotency),
  `seed/index.ts` runs part 1+2, boot hook in `AppModule.onModuleInit`,
  `POST /api/settings/demo-data/refresh` (`settings.manage`) + web button.
- Module 12 (dashboards): `docs/dashboards.md` (A1-A4 implemented + K/P/R defined),
  `modules/dashboards/` (`adminFigures` SQL aggregates, `GET /api/dashboards/admin`
  under `billing.read`), `hooks/use-dashboard.ts`,
  `features/dashboard/admin-dashboard.tsx` (Card composition), admin page renders it.
- Module 13 (README/final): surgical README updates to G5 reality (status table,
  tour, dashboards, seed, prioritisation, limitations, business-rules rows);
  `/status` page already compliant (no figures); no leftovers added.

## 3. Files (paths)

- `apps/api/prisma/seed/part-2.ts`, `part-2.spec.ts`, `seed/index.ts` (EDIT)
- `apps/api/src/modules/dashboards/` (NEW: module/controller/service/spec),
  `apps/api/src/app.module.ts` (EDIT: import + hook + dashboards import)
- `apps/api/src/modules/settings/` (EDIT: service + controller refresh action)
- `apps/web/src/hooks/use-dashboard.ts`, `use-settings.ts` (EDIT),
  `features/dashboard/admin-dashboard.tsx` (NEW),
  `app/(staff)/admin/dashboard/page.tsx` (EDIT: render, guard unchanged),
  `features/settings/settings-form.tsx` (EDIT: refresh button)
- `docs/dashboards.md` (NEW), `README.md` (EDIT), `docs/DECISIONS.md` (unchanged)

## 4. Domain functions

- `seedPart2(prisma, now)` — matrix in §2 header comment; helpers
  `recentDeliveryDays`, `upcomingOpenDates`, `confirmedOnly`, `finishChain`,
  `startFirstUnit`, `finishAllUnits`, `timedDetails`, `ensureMarkerUser`.
- `DashboardsService.adminFigures()` — A1 window aggregate, A2 billable + top 5,
  A3 unpaid + oldest age, A4 default-tier gaps via `resolveDishPrice`.

## 5. Endpoints

- `GET /api/dashboards/admin` (`billing.read`) → A1-A4 JSON.
- `POST /api/settings/demo-data/refresh` (`settings.manage`) → counts.

## 6. Transactions/concurrency

- All writes through the real services (their transactions/locks apply);
  seed verification is count-based (no version races by design).

## 7. Tests

- `part-2.spec.ts`: status spread incl. all six statuses, totals reconcile
  (order=sum lines=sum combos, invoice=sum orders), driver drops today, paid +
  unpaid invoices, reviewer row untouched, second run creates zero rows.
- `dashboards.spec.ts`: A1 spread + six keys, A2 zero-state, confirm-via-cutoff
  → billable → invoice → A3 count/sum/age 0, A4 gap count 1.

## 8. Ambiguities

None new. K/P/R-as-board-figures is prioritisation (§6), recorded in README.

## 9. Gate

- `check-types` (api+web+shared) ✓, `lint` ✓, `prisma validate` ✓ (ran).
- DB specs: BLOCKED — shared TEST DB under continuous concurrent G4 runs;
  every attempt fails inside `ensureBaseData` truncation races (logs kept).
  Re-run when quiet; code reviewed + date math walked through statically.

## 10. Audit traceability

| Plan item | PDF § (≤15 words) + skill/D | Verdict |
|-----------|-----------------------------|---------|
| Demo orders every status, past/today/future | §2 "orders in every status" + seed-demo-data | OK |
| Driver drops today, several stages | §2 "deliveries assigned" + D-70 | OK |
| Paid + unpaid invoices, billable leftovers | §2 implied + billing/D-53 | OK |
| Marker user, refresh-only-demo, idempotent | D-77 | OK |
| No Draft/Placed on past-cut-off dates | seed-demo-data rule 5 | OK |
| Boot hook + admin refresh, best-effort boot | seed-demo-data rule 4 | OK |
| A1-A4 server aggregates, honest zeros/n/a | §4.11 + dashboards | OK |
| K/P/R defined, shown on boards | dashboards skill | OK |
| README §8 content + §6 notes | §8 twelve items + §6 three items | OK |
| Beyond the PDF | refresh endpoint is skill-prescribed (source of truth), not extra | OK |
