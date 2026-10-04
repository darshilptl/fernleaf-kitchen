# Seed part 1 (backend + data)

PDF sections: 2 ("Data"), 4.1, 4.2, 4.3, 4.4, 4.5, 7 (money). Skills read: module-workflow,
seed-demo-data, pricing, catalogue-and-menu, companies-employees, time-and-cutoff, ambiguity-log,
testing, frontend-standards (no UI in this task). Decisions touched: D-05..D-16, D-18..D-27, D-32,
D-34..D-41, D-43, D-75..D-79. Source of truth: `docs/demo-data.md` loads exactly; `docs/assignment.txt`
canonical; DECISIONS.md overrides skill prose.

## 1. Flags from review (conflicts, risks)

1. `packages/shared/time.ts` does not exist (time helpers land in Group 3, module 6).
   Seed needs date-relative holidays, and AGENTS §7 assigns `kitchenToday`/`addDays` to
   `packages/shared/time` with Luxon, which is not a shared dependency today. Proposed
   prerequisite (needs approval): minimal `packages/shared/time.ts` (`KITCHEN_TIME_ZONE`,
   `kitchenToday`, `addDays` only) + `luxon` in shared dependencies, as the single owner
   Group 3 extends. Alternative (rejected): hand-rolled offsets in seed — violates the skill
   and AGENTS §7.
2. No `setCategoryActive` exists (only `updateCategory`, full replace, no `isActive`); Seasonal must
   end inactive and raw writes are banned. Approved addition (PDF 4.2 Must gap): add
   `MenuService.setCategoryActive` mirroring `setDishActive`, plus endpoint
   `POST /menu/categories/:id/deactivate|activate` (`menu.manage`, catalogue pattern), a toggle
   in the menu screen (AlertDialog confirm on Hide per AGENTS §12.4; direct on Show), and a test.
   The seed uses the service. Also: the existing placement Hide toggle gets the same AlertDialog
   confirm; confirm both toggles work in the UI (manual list below).
3. D-77 has no operative text (row 87 points at text that is not in the log). The doc commands
   create-if-missing by natural key and never delete; schema is frozen, so no marker column can be
   added. Proposed D-80: part-1 rows are identified by their doc-fixed natural keys only.
4. AGENTS §§12–15 now exist and apply: audit per §15 traceability format (§10 below);
   logging per §13 (seed logs through the existing `logAction` helper — interceptor already
   global); menu toggles per §12.4 (AlertDialog on deactivate).
5. `docs/demo-data.md` says "Addresses: invent plausible values" while commanding stable reruns:
   invented values are fixed as constants in the seed file (proposed D-81), so reruns match.
6. First tier auto-becomes default in code (`createTier`: `isDefault: count === 0`), so creating
   Standard first satisfies D-86 with no extra call. Enterprise override BWL-102 = 7.25 typed.
7. Spot-checked doc math against the cents rule: Enterprise BWL-101 700×1.15=805 ✓; Partner
   BWL-101 310×2.4=744→745 ✓; BRK-202 Partner 190×2.4=456→460 ✓; DST-301 Enterprise 350×1.15=402.5→405 ✓.
8. driver@test.com must exist before companies reference it: seed calls `ensureBaseData` first
   (same as boot). No boot hook yet, no orders/invoices/dashboard data — Group 5 (excluded here).

## 2. Scope: [Must] items / [Should] items (each with PDF line)

- [Must] Reference data, catalogue, tiers, companies+employees, menu per `docs/demo-data.md`
  (PDF §2 "Data"; PDF 4.1/4.2/4.3/4.4/4.5 rule coverage via real services).
- [Must] Idempotent create-if-missing; never overwrite or delete (doc + seed-demo-data rules 2–3).
- [Must] Run through the prisma.config seed entry (`pnpm --filter api db:seed`).
- [Must] Acceptance test: menu preview for the four named employees equals the doc's "Expected
  previews" exactly (PDF §7 correctness).
- [Should] None in this task. Portion group from the skill's "required content" is NOT seeded:
  doc says portions not sold (§4.1 [Should] deferred); seeding one would contradict the doc.
  Explicitly out.
- Out: boot hook, `ensureDemoData`, orders, invoices, dashboards data (Group 5); frontend (none).

## 3. Files (paths)

- NEW `packages/shared/time.ts`: `KITCHEN_TIME_ZONE`, `kitchenToday(now)`, `addDays(date, n)` via
  Luxon; export from `packages/shared/src/index.ts`. EDIT `packages/shared/package.json`: add `luxon`.
  Single owner Group 3 (module 6, cut-off) extends.
- EDIT `apps/api/src/modules/menu/menu.service.ts`: add `setCategoryActive(id, active)` (spec:
  deactivates/reactivates, 404 `MENU_NOT_FOUND` on unknown). EDIT
  `apps/api/src/modules/menu/menu.controller.ts`: `POST /menu/categories/:id/deactivate|activate`
  (`menu.manage`). EDIT `apps/web/src/features/menu/placement-manager.tsx` (or category list):
  category Active/Inactive toggle (AlertDialog on Hide); placement Hide toggle gets the AlertDialog
  confirm; manual UI confirm in the checklist below.
- NEW `apps/api/prisma/seed/part-1.ts`: `seedPart1(prisma: PrismaService): Promise<void>` —
  sectioned helpers `seedReference`, `seedOptions`, `seedDishes`, `seedTiers`, `seedCompanies`,
  `seedEmployees`, `seedMenu`; fixed `ADDRESSES` constants; `nextWeekday(today, isoDay)` helper.
- NEW `apps/api/prisma/seed/index.ts`: runs `ensureBaseData` then `seedPart1` (Group 5 appends part 2).
- EDIT `apps/api/package.json`: add `"db:seed": "prisma db seed"`.
- NEW `apps/api/prisma/seed/part-1.spec.ts`: idempotency + expected-previews acceptance test
  (picked up by vitest `**/*.spec.ts`; serial file order; TEST database only).

## 4. Domain functions (name, signature, numbered algorithm, invariants, edge cases)

- `kitchenToday(now: Date): CalendarDate` (shared/time, NEW): 1. take `now`; 2. convert to
  `Asia/Kolkata` via Luxon; 3. return `YYYY-MM-DD`. Invariant: ONLY source of "today".
  Edge: DST-free zone, no ambiguity.
- `addDays(date: CalendarDate, n: number): CalendarDate` (shared/time, NEW): UTC-midnight
  arithmetic, returns `YYYY-MM-DD`. Used only for holiday offsets.
- `nextWeekMonday(today)` (seed-local): Monday of the ISO week starting after today =
  `addDays(today, 8 - isoWeekday(today))`. Acme Friday = +4, Hooli Monday = +0. Edge: run on a
  Sunday still lands 8 days out (next day is Monday, but "next week" starts the Monday after);
  always strictly future. Holidays are named "Demo day off"; skip creating one if a holiday with
  that name exists on or after today (repeat runs never accumulate).
- `seedPart1(prisma)`: 1. `ensureBaseData(prisma)`; 2. reference → options → dishes+groups →
  tiers+rules+typed prices → companies (+tier/holiday/hiding) → employees (+flags/deactivations) →
  menu (categories → placements → placement/item deactivations → category deactivation).
  Seed employees get no credentials at all (the Employee model has no password field); only the
  four test accounts have known passwords. The inactive system user seed@fernleaf.test (random
  unguessable hash, D-77) is created in Group 5 with the demo orders, not here.
  Every section logs through the existing `logAction` helper (ids only, AGENTS §13).
  Every write is create-if-missing by natural key (SKU, option/tier names, domain, email, slug,
  address label per company); existing rows are reused untouched — including typed prices
  (never overwritten). Invariant: second run changes zero rows. Edge: pre-existing reviewer rows
  with colliding keys are left alone (never overwrite, never delete).
- Expected-preview comparison (test-local): map actual preview to
  `{categories: [{name, items: [{name, priceCents}]}]}` + `banner`; deep-equal to literals
  transcribed from the doc. Oats absence, Quinoa absence, secret/Seasonal exclusion, and the Omar
  inactive banner are all asserted by equality (no special cases).

## 5. Endpoints (method, path, permission key, request schema, response, error codes)

None. No endpoints, no DTOs, no frontend. Seed and test only.

## 6. Transactions, locks and concurrency

Seed runs serially via `prisma db seed`; idempotency comes from lookup-before-create on unique
natural keys, not locks. Service-internal transactions (company+owner, batch prices, hide-set
replace, reorder) are reused untouched. No nested transactions added. Concurrency: seed is not
run concurrently (single CLI invocation); the acceptance test truncates first per repo harness.

## 7. Tests (named by rule)

- `seeding twice changes zero rows` (counts of dishes/options/tiers/companies/employees/categories
  snapshotted between runs).
- `pre-existing rows are never overwritten` (pre-create BWL-101 with a wrong price + one company
  with an extra domain; rerun; assert both untouched).
- `Riya Shah sees the Enterprise menu exactly` / `Maya Rao sees Standard without Desserts` /
  `Ishaan Gupta sees Partner with hidden Gulab Jamun` / `Omar Sheikh gets the inactive banner` —
  each deep-equals the doc's "Expected previews", including the `chefs-table` slug cases
  (`preview(id, 'chefs-table')` for Riya and Ishaan).
- `setCategoryActive deactivates Seasonal` (new service spec alongside).
- Time helpers: `kitchenToday` matches Asia/Kolkata date (shared spec; identical under
  `TZ=UTC` and `TZ=America/Los_Angeles`).

## 8. New ambiguities with proposed D-entries (ID, PDF section, ambiguity, decision, why, alternative)

| ID | PDF § | Ambiguity | Decision | Why | Alternative |
|----|-------|-----------|----------|-----|-------------|
| D-81 | 2 | D-77 marker text missing; how to tag part-1 rows | Natural keys only (SKU/slug/email/domain/name); no marker column | Schema frozen; never-delete makes keys sufficient | New marker column |
| D-82 | 2 | "Invent plausible" addresses vs stable reruns | Fixed address constants in the seed file | Deterministic reruns | Random per run |
| D-83 | 2 | "Friday/Monday of next week" definition | ISO week starting the Monday after today; Monday +0, Friday +4; named "Demo day off"; skip if one exists on/after today | Least inventive calendar reading; always future; no accumulation | N days out |
| D-84 | 4.2 | No category active toggle, Seasonal must be inactive | Add `MenuService.setCategoryActive` + endpoint + UI toggle (AlertDialog on Hide) | Mirrors `setDishActive`; raw writes banned; §12.4 | Raw prisma update in seed |
| D-85 | 7 | `shared/time` missing, Luxon not a shared dep | Minimal `time.ts` + luxon dep now; Group 3 (module 6) extends the single owner | AGENTS §7 ownership; skill mandates Luxon | Hand-rolled offsets |
| D-86 | 2 | Seed credentials (D-78 needs ≥8, but no known passwords allowed) | Seed employees get no credentials (Employee has no password field); only the four test accounts have known passwords; seed@fernleaf.test deferred to Group 5 with a random hash | Reviewers sign in only as staff; deterministic reruns | Fixed documented password |

## 9. Gate checklist

`pnpm check-types && pnpm lint && pnpm test`, plus `pnpm --filter api prisma generate`.
Seed itself runs only against a TEST database (override DATABASE_URL on the command line) until
approved for any other database — never against dev/prod without explicit approval.

## Files list

`packages/shared/time.ts`, `packages/shared/package.json` (luxon), `packages/shared/src/index.ts`
(export), `apps/api/src/modules/menu/menu.service.ts` (+spec), `apps/api/src/modules/menu/menu.controller.ts`
(deactivate|activate endpoints), `apps/web/src/features/menu/placement-manager.tsx` (category toggle +
placement Hide confirm), `apps/api/prisma/seed/part-1.ts`,
`apps/api/prisma/seed/index.ts`, `apps/api/package.json` (`db:seed`),
`apps/api/prisma/seed/part-1.spec.ts`.

## Manual check list (runner: `DATABASE_URL=<test-db-url> pnpm --filter api db:seed`, twice.
The seed entry connects through `PrismaService`, i.e. DATABASE_URL — overriding DIRECT_URL alone
still seeds the dev database. Never point DATABASE_URL at dev/prod without explicit approval.)

1. Counts after run 1: 8 allergens, 5 tags, 4 stations, 2 portions, 3 packaging, 7 options,
   9 dishes, 3 tiers, 5 companies, 19 employees, 5 categories; run 2 changes nothing.
2. Enterprise grid spot-check: BWL-101 805, BRK-202 absent; Partner BWL-102 625.
3. Preview as riya.shah@acme-foods.example matches doc line 78 incl. `chefs-table` slug case.
4. Pre-created BWL-101 (price 999) + extra Acme domain survive a rerun byte-identical.
5. Menu screen: Hide a placement → AlertDialog states the consequence; Show is direct; category
   Hide/Show toggle works the same; Seasonal stays inactive after seed rerun.

## 10. Audit traceability (AGENTS §15 format: item, PDF quote ≤15 words, D-ID/skill, verdict)

| Plan item | PDF § (≤15 words) | D-ID / skill | Verdict |
|---|---|---|---|
| Reference/options/dishes/groups via services | "Reference data. Allergens, dietary tags..." (§4.1) | catalogue-and-menu | OK |
| Tiers, COST/TIER rules, batch typed prices | "A tier can derive its prices..." (§4.3) | pricing, D-10..D-16 | OK |
| Companies, owner-first create, domains, addresses, calendar, defaults | "A company has a name, one or more email domains..." (§4.4) | companies-employees, D-18..D-27, D-32 | OK |
| Employees, flags, allergies, deactivations, no credentials | "Every customer is an employee of exactly..." (§4.5) | companies-employees, D-21/D-22/D-25, D-86 | OK |
| Categories, multi-placement, secret slug, hiding, preview | "Dishes are shown to employees through categories..." (§4.2) | catalogue-and-menu, D-34..D-41 | OK |
| BRK-202 absent on Enterprise (no fallback) | "must not appear on their menu at all" (§4.3) | D-13 | OK — asserted |
| Required-group option pricing; unpriced option unselectable | "Every combination must satisfy every required group" (§4.1) | D-15 | OK — asserted via Thali groups |
| Omar inactive banner; Meera inactive; Stark inactive | "Working days and company holidays..." (§4.4) | D-41 | OK — asserted |
| COL-401 inactive placement; secret/Seasonal exclusion; slug cases | "secret, meaning it is not listed..." (§4.2) | D-35, D-36, D-38 | OK — asserted |
| Holidays "Demo day off", skip-if-exists | "Working days (default Mon–Fri) and company holidays" (§4.4) | D-83 | OK |
| Fixed invented addresses | "one or more delivery addresses" (§4.4) | D-82 | OK |
| Natural-key marking, no deletes | "Dishes are deactivated, never hard-deleted" (§4.1) | D-81, seed-demo-data r2–3 | OK |
| `setCategoryActive` + endpoint + UI toggle; placement confirm | "activated or deactivated" (§4.2) | D-84, AGENTS §12.4 | OK |
| `shared/time` + luxon; Group 3 extends | "The kitchen operates in one time zone" (§7) | D-85, D-43, time-and-cutoff | OK |
| Console action logging via existing `logAction` | "Logging to the console is fine" (§5) | D-80, AGENTS §13 | OK |
| Acceptance test equals doc previews | "Cut-offs, pricing and money are right" (§9) | testing | OK |
| Skill boot hook / today's orders / billing content | "keep it running ... realistic data" (§2) | seed-demo-data r4/r6 | DEFERRED to Group 5 (staged, not contradiction) |
| Skill "one portion group" | "Portions [Should]" (§4.1) | Doc wins per §0.1 | LABELED Beyond this task (doc: not sold) |

### Audit iteration 2 (re-verify after amendments)

- D-80..D-85 renumbered to D-81..D-86; new D-80 = console logging; D-77 text appended to DECISIONS.md; `Review@1234` removed everywhere (amendment 4); Group 3/module 6 fixed (amendment 6); holidays redefined per amendment 5.
- Re-check: zero contradictions, zero unlabeled unsupported items.
