# Group 2: Money and people — modules 3, 4, 5 (backend + frontend)

PLAN ONLY. Do not implement. Stop and wait for approval after the audit.

PDF sections: 4.1 (catalogue reference scope only), 4.2, 4.3, 4.4, 4.5, 7 (money, validation, pagination, tests).
Skills read: module-workflow, pricing, companies-employees, catalogue-and-menu, ambiguity-log, testing,
frontend-standards. Decisions touched: D-05..D-16, D-18..D-27, D-32..D-41, D-75. D-01..D-79 frozen.
Source of truth: `docs/assignment.txt` canonical; DECISIONS.md overrides skill prose.

Reference studied (read-only): `Development LAB/store.craftlytech` — the prompt names
`Development LAB/store`, which does not exist; the least-inventive reading is `store.craftlytech`
(assumption flagged in §1). Tables, catalogue/menu/company-employee screens only; sidebar already reused.

## 1. Flags from review (conflicts, risks, assumptions)

1. **Module 2 catalogue does not exist.** Only `modules/auth` exists in the api; web has no catalogue
   routes. Pricing grid, menu placements, and option pricing all need dishes/options/groups. Proposed
   resolution (needs approval): Group 2 builds a minimal `catalogue` prerequisite — reference-data CRUD
   (allergens, dietary tags, stations, portion sizes, packaging types) + dishes/options/groups CRUD,
   Must-only per PDF 4.1 (portions [Should] deferred; `usesPortions` rejected). Without this, Group 2
   cannot be built or tested.
2. **AGENTS §§12–15, §12 DataTable/Sheet/AlertDialog rule, §13 logging do not exist** (AGENTS.md ends at
   §11a). Least-inventive substitutes used in this plan: shadcn Table/Dialog/AlertDialog/Tabs/Select/Badge
   composed per §5.6; "logging" = `console.*` where the PDF implies a notice (nothing in Group 2 sends
   email; CSV import returns row errors in-band).
3. **No shadcn data-table primitive and no `@tanstack/react-table`** in the repo. The reference uses plain
   shadcn `Table` (not react-table). Plan follows the reference: a shared `DataTable` wrapper around
   shadcn `Table` (server pagination controls, dense rows). No new dependency. `@tanstack/react-table`
   listed as an alternative pending explicit approval — not used.
4. **CSV parsing without a library.** `papaparse` would be a new dependency (needs approval). Plan:
   hand-rolled 2-column parser (name,email; header required; quoted-field aware) + unit tests. Queued
   last as [Should] per skill.
5. **Employee-move guard vs prompt.** Prompt defers the D-29 move guard to Group 3. Deviation proposed:
   implement the guard query now against existing (empty) order tables — vacuously true pre-Group-3,
   D-29 compliant from day one. Approve or revert to unrestricted moves.
6. **Reference audit (AGENTS §8.2).** Reuse after audit: plain shadcn `Table` pattern (`product-table.tsx`),
   thin page + colocated section components, `Empty` states, `AlertDialog` confirms, Sheet forms.
   Do better (violations in reference, not copied): direct Prisma in pages → HTTP + TanStack hooks
   (AGENTS §2); `sonner` → installed Base UI toast manager; zustand + `useEffect` fetching → hooks-only
   queries; hardcoded colors/gradients/`dark:` classes/arbitrary values → tokens only, light only;
   `@tabler/icons-react` → `lucide-react` (repo standard, `components.json` iconLibrary).
7. **New shadcn components needed** (CLI only, per Group 1 rule): `table`, `dialog`, `alert-dialog`,
   `tabs`, `select`, `badge`, `checkbox`, `dropdown-menu`. All exist upstream; no new npm dependency.
8. **Tiers seed.** PDF assumes tiers exist ("one tier is the default") but defines no seed. Proposed
   D-86: first created tier auto-becomes default; no delete endpoint (deactivate only, with guards).
9. Settings row + reference data re-ensured per test file per testing skill (existing `test/db.ts` +
   global setup pattern from Group 1).
10. **Staff-list dependency for the driver picker.** Company delivery defaults need a default driver
    (active staff holding `deliveries.assignable`), but no staff-list endpoint is known to exist
    (Group 1 built auth only). Proposed resolution (needs approval): minimal
    `GET /staff/drivers` in Group 2 returning `{ id, name, email }` of active assignable staff
    (`staff.manage` to list? or any authenticated staff setting up companies — propose `companies.read`,
    recorded below as deviation for approval). Alternative: free-typed driver with validation error.
11. **Empty-DB bootstrap.** Company create requires an existing packaging type and tier link is
    optional; reference CRUD creates them. No seeding: create fails validation until data exists
    (honest, no hidden defaults). Same for tiers (D-86 covers first-tier default).

## 2. Scope

### Module 3 — pricing (Must: PDF 4.3)

- Tiers CRUD; exactly one default (partial unique index); default swap in one transaction; default tier
  cannot be deactivated; tier in use by any company cannot be deactivated.
- Rule editor: basis COST (× multiplier on cost) or TIER (source tier + percent); `multiplierBp`
  (10000 = ×1.00); save-time cycle walk, self-source reject, depth cap 5.
- Typed-price grid per tier: every active dish + option with
  `{ manualCents, effectiveCents, source: MANUAL | DERIVED | NONE }`; "missing price" filter;
  batch save (`PUT /pricing/tiers/:id/prices`) in ONE transaction; clearing a typed price deletes the
  row (falls back to derived) — proposed D-82.
- Resolver math in `packages/shared` (`ceilToFiveCents`, `parseMultiplier`), resolution in
  `api/.../pricing/domain` (`resolveDishPrice` / `resolveOptionPrice`, visited-set, depth 5, D-11..D-16).
- Price edits never touch past orders (no order module yet; snapshot rule recorded for Group 3).
- The ten pricing skill tests.

### Module 4 — companies and employees (Must: PDF 4.4, 4.5; CSV [Should] last)

- `POST /companies`: company + owner employee in ONE transaction; owner belongs to same company;
  owner cannot move/deactivate until replaced (D-18).
- Domains: trim/lowercase/strip `@`, hostname check, `PUBLIC_EMAIL_DOMAINS` blocklist (shared), global
  uniqueness (DB), ≥1 always; employee email NOT checked (D-20).
- Addresses: ≥1 active, exactly one active default (partial unique index); default swap in one
  transaction; never hard-deleted.
- Calendar: ISO 1–7 working days (≥1, default Mon–Fri); holidays unique per date; `isCompanyDeliveryDay`
  in shared; edits never blocked (D-27).
- Delivery defaults: `defaultDeliveryMinute` 0–1439, `dispatchLeadMinutes` 0–720 (default 60), default
  packaging (D-24 table), driver instructions, default driver (active + `deliveries.assignable`).
- Tier link (`priceTierId?`); per-company hidden categories/items endpoints (replace full set in one
  transaction — serves module 5).
- Deactivated company blocks new orders; history untouched. Never hard-delete companies/employees/
  addresses.
- Employees table with create/edit/deactivate; flags default false (D-22); allergies/dietary from
  reference lists, stored only (D-25); email globally unique lowercase.
- Company detail with tabs (profile / addresses / calendar / employees / menu & price).
  No billing tab (billing module does not exist yet).
- CSV import [Should], built last: columns `name,email`, header required (proposed D-85), ≤1000 rows,
  validate-all then insert-valid in ONE transaction, `{ imported, errors: [{ row, message }] }`.
- Skill test list for companies-employees.

### Module 5 — menu and preview (Must: PDF 4.2)

- Categories: order (`sortOrder`), active flag, secret + unique slug (slugify name + numeric suffix —
  proposed D-84); items = dish placements (dish may sit in many categories, D-34); reorder = one atomic
  bulk update; categories/items hard-deletable (D-40).
- Per-company hiding (endpoints in module 4); placement-level hiding (D-34).
- ONE `MenuResolver.resolveForEmployee` (api domain): the six availability rules (active dish; ≥1
  visible placement; tier price > 0; required groups have ≥1 active+priced option; portion invariant;
  secret excluded unless by slug), sort by `sortOrder` then name, empty categories omitted, employee
  view fields only (no sku/cost).
- Preview as an employee: employee picker (any active employee + banner for inactive — proposed D-83,
  least inventive reading of "as a given employee" + D-41); returns exactly the employee view (D-39).
  Preview + future order form + Group 3 place-time validation all call the resolver; nothing else
  decides availability.
- Tests: six availability rules, secret slug, hiding placement vs category, reorder atomicity, preview
  equivalence with resolver output, price-absent dish hidden (with module 3).

### Module 2 prerequisite (needs approval, see §1.1)

Minimal `catalogue` module: reference-data CRUD + dishes/options/groups CRUD, Must-only (4.1),
`usesPortions` rejected until portions work. No menu, no pricing UI here.
Field allowlist (schema-bound, nothing more): dish `name, description?, imageUrl?` (URL only,
D-09), `sku` (unique string, D-08), `temperature`, `costCents >= 0`, `stationId?`,
`minOrderQuantity?`, `isActive`; option `name, description?, costCents >= 0, isActive`; group
`name, isRequired, sortOrder` (`usesPortions` forced false). Reference deactivation: allergens/tags
hide from pickers only (links stay); station blocked while an active dish uses it; portion size
blocked while a group sells it (skill: catalogue-and-menu).

## 3. Files (exact paths)

Shared (`packages/shared/src`): `pricing.ts` (`ceilToFiveCents`, `parseMultiplier`,
`PUBLIC_EMAIL_DOMAINS`, `normalizeDomain`, `isPublicDomain`), `calendar.ts`
(`isCompanyDeliveryDay`; AGENTS §7 single owner),
`schemas/pricing.ts` (tier, rule, batch prices, grid query), `schemas/companies.ts`,
`schemas/employees.ts` (incl. CSV row), `schemas/menu.ts`, `schemas/catalogue.ts`,
`errors.ts` (add codes §5). Tests: `pricing.spec.ts`, `calendar.spec.ts` (pure math only).

API (`apps/api/src/modules`): `pricing/` (`pricing.module/controller/service`,
`domain/resolve-price.ts`, `dto/*.schema.ts` re-export, `*.spec.ts`);
`catalogue/` (same shape, `domain/catalogue-validation.ts`);
`companies/` (`companies.module/controller/service`, `domain/company-guards.ts`, dto, spec);
`employees/` (same shape; CSV DB checks in service, pure parse in shared);
`menu/` (`menu.module/controller/service`, `domain/menu-resolver.ts`, spec).
Register all modules in `app.module.ts`.

Web (`apps/web/src`): routes `app/(staff)/admin/pricing/page.tsx`,
`app/(staff)/admin/companies/page.tsx`, `app/(staff)/admin/companies/[id]/page.tsx`,
`app/(staff)/admin/menu/page.tsx`; `features/pricing/` (tier list, rule editor, price grid),
`features/companies/` (company table, company form, detail tabs), `features/employees/`
(employee table, dialog, CSV dialog last), `features/menu/` (category list, placement manager,
preview picker + preview view); `hooks/use-pricing.ts`, `hooks/use-companies.ts`,
`hooks/use-employees.ts`, `hooks/use-menu.ts` (TanStack Query inside hooks only);
`components/data-table.tsx` (shared wrapper: shadcn Table, dense `text-body-sm`,
`hover:bg-background-hover`, server pagination, filters-above slot, Empty/loading/error states).
`lib/nav.ts`: add Pricing (`pricing.read`, icon), Companies (`companies.read`),
Menu (`menu.read`) entries (permission-keyed, no structural change). No top-level employees
route: employees live in the company detail tabs.
CLI: `table dialog alert-dialog tabs select badge checkbox dropdown-menu` (+ auto deps).

### 3b. Frontend standards (all Group 2 screens; ui-shell.md contract applies)

- Page header per screen: H1 `heading-sm` + `description-sm`, actions right-aligned; one H1 per page.
  Panels `bg-background-panel`, cards `rounded-lg shadow-card`; gaps 4/6/8; tables dense
  `text-body-sm`, row hover `bg-background-hover`, server pagination, filters above.
- Typography: titles/descriptions from scale; money/counts with `tabular-nums`;
  `formatMoney` display only (never compute totals — server owns them).
- Forms: shared Zod schema → inferred type → `react-hook-form` + `zodResolver`; server `{code,path,
  message}[]` mapped via `applyServerErrors`; unmapped → toast (Base UI manager). Money inputs are
  dollars strings parsed by `parseMoney` at the schema boundary.
- States: every list and form has loading (`Skeleton`), empty (`Empty`), error (toast + retry),
  success (invalidate query key) states. Deactivations and destructive confirms via `AlertDialog`;
  create/edit via `Sheet` + `Dialog` composition (shadcn only).
- Data: TanStack Query inside `hooks/use-*.ts` only; one `lib/api-client.ts`; no `useEffect`
  fetching; functional components only.
- Motion: none named (dialog/sheet built-ins only). Accessibility: labels on all inputs,
  focus-visible ring global, one H1, full keyboard operability, `aria-hidden` decorative only.

## 4. Domain functions (pure; header comment per AGENTS §4.8; `now` param where time applies)

- `ceilToFiveCents(baseCents, multiplierBp): number` (shared) — `Math.floor((n+49999)/50000)*5`;
  exact multiples unchanged (D-11). Edge: 0 stays 0 (D-14 handled by callers).
- `parseMultiplier(input: string): number` (shared) — `"2.4"`→24000, `"+15%"`→11500, max 4 decimals;
  string handling only, throws on invalid.
- `resolveDishPrice(dish, tier, ctx): number | null` (api) — typed → rule(COST|TIER recursive) →
  null; dish requires > 0; no default-tier fallback (D-13); visited-set + depth 5.
  `resolveOptionPrice` identical except 0 valid (D-14); missing = unselectable (D-15).
- `validateTierRule(chain): void` (api) — self-source, cycle, depth-5 reject.
- `normalizeDomain / isPublicDomain` (shared) — trim/lower/strip `@`/hostname/PUBLIC list (D-19).
- `isCompanyDeliveryDay(workingDays, holidays, date): boolean` (shared) — working day AND not
  holiday; company calendar never touches cut-off (D-27/D-45 scope note).
- `parseEmployeeCsv(text): { rows, errors }` (shared, pure; DB checks stay in service) — header
  `name,email` required (D-85), ≤1000 rows, quoted-field aware.
- `MenuResolver.resolveForEmployee(employeeId)` (api service+domain) — six rules (§2 module 5);
  secret-by-slug variant shares the predicate. Nothing else decides availability.

## 5. Endpoints (REST `/api`; Zod pipe; `RequirePermission`; `{code,path,message}[]`)

Pricing (`pricing.read` list/grid/get; `pricing.manage` writes):
`GET /pricing/tiers`, `POST /pricing/tiers`, `PATCH /pricing/tiers/:id`,
`POST /pricing/tiers/:id/make-default`, `POST /pricing/tiers/:id/deactivate|activate`,
`PUT /pricing/tiers/:id/rule`, `GET /pricing/tiers/:id/grid?missingOnly=`,
`PUT /pricing/tiers/:id/prices`. Errors: `TIER_NOT_FOUND 404`, `TIER_CYCLE 409`,
`TIER_SELF_SOURCE 409`, `TIER_DEPTH 409`, `TIER_IN_USE 409`, `TIER_DEFAULT_IMMUTABLE 409`.

Catalogue prerequisite (`catalogue.read/manage`): `/reference/:list` CRUD + activate/deactivate
(allergens, dietary-tags, stations, portion-sizes, packaging-types);
`/dishes`, `/dishes/:id`, `/options`, `/options/:id`,
`/dishes/:id/groups`, `/groups/:groupId`, `/groups/:groupId/options`.
Errors: `SKU_TAKEN 409`, `REFERENCE_IN_USE 409`, `PORTIONS_DEFERRED 409`.

Companies (`companies.read` list/get; `companies.manage` all writes): `GET /companies?page&pageSize&search`,
`POST /companies` (company + owner, one tx; required: `name`, `billingContactName`, `billingEmail`
(D-32), ≥1 domain, ≥1 address, `defaultDeliveryMinute`, `defaultPackagingTypeId`; optional:
`billingPhone?`, `billingAddress?`, `priceTierId?`, `dispatchLeadMinutes?` default 60,
`driverInstructions?`, `defaultDriverId?`; name NOT unique, D-33), `GET/PATCH /companies/:id`,
`POST /companies/:id/deactivate|activate`, `POST /companies/:id/addresses`
(+ `:addressId/make-default`), `POST /companies/:id/domains`, `DELETE .../domains/:domain`,
`POST /companies/:id/holidays`, `DELETE .../holidays/:date`,
`PUT /companies/:id/hidden-categories|hidden-items` (replace set, one tx),
`PUT /companies/:id/tier`, `GET /staff/drivers` (minimal `{id,name,email}` of active assignable
staff for the default-driver picker; `companies.read`; scope addition per §1.10 — alternative is
free-typed driver + validation error). Errors: `COMPANY_NOT_FOUND 404`, `DOMAIN_TAKEN 409`,
`DOMAIN_PUBLIC 409`, `COMPANY_LAST_DOMAIN 409`, `COMPANY_LAST_ADDRESS 409`,
`ADDRESS_NOT_FOUND 404`, `OWNER_IMMUTABLE 409` (move/deactivate owner, D-18),
`DRIVER_INELIGIBLE 409`.

Employees (`employees.read/manage`): `GET /companies/:companyId/employees`,
`POST .../employees`, `PATCH /employees/:id` (incl. company move + guard),
`POST /employees/:id/deactivate|activate`, `POST .../employees/import` (CSV last).
Errors: `EMPLOYEE_NOT_FOUND 404`, `EMPLOYEE_EMAIL_TAKEN 409`, `EMPLOYEE_MOVE_BLOCKED 409`,
`CSV_TOO_LARGE 409`.

Menu (`menu.read` list/get/preview; `menu.manage` writes): `GET /menu/categories`, `POST ...`, `PATCH .../:id`,
`POST .../:id/reorder` (bulk, one tx), `DELETE .../:id`,
`POST /menu/categories/:id/items`, `PATCH/DELETE /menu/items/:itemId`,
`GET /menu/preview?employeeId=` (+ `&slug=` for secret). Errors: `MENU_NOT_FOUND 404`,
`MENU_SLUG_TAKEN 409`, `EMPLOYEE_NOT_FOUND 404`.

All lists server-paginated (`page` default 1, `pageSize` default 20, max 100); money as integer
cents in/out (strings at the form boundary via `parseMoney`/`formatMoney`).

## 6. Transactions, locks, concurrency

`prisma.$transaction` per multi-write op; no nesting. Default swap, batch prices, company+owner
create, address-default swap, hide-set replace, reorder — each one transaction. Concurrency tests
(per testing skill `Promise.allSettled` pattern): double default-swap (one wins / idempotent 200s),
duplicate domain race (one 409), batch-price races (last-writer-wins on distinct rows; same-row
upsert idempotent), reorder races (single bulk write wins). No version column outside orders.

## 7. Tests (one behaviour per test, named by rule; Vitest colocated; real PG + truncate)

Shared: ceil math (310→745, 184→215, exact-5 unchanged, typed unrounded note via resolver test),
multiplier parse ×3 + invalid, domain normalize ×3 + public reject, delivery-day ×4, CSV parse
(header missing, quotes, >1000 rows).
Pricing (ten): the skill's ten cases verbatim, plus grid source flags, missingOnly filter,
batch atomicity (one bad row → 409, nothing written), default-swap single-default invariant,
deactivate guards (default / in-use), concurrency: double make-default.
Companies/employees: skill list (domain case/`@`, public, last-domain/address protected, owner
move/deactivate blocked, single default, move guard with open orders, CSV 5-rows-3-problems),
plus transactionality (company+owner all-or-nothing), tier link round-trip.
Menu: six availability rules individually, secret excluded/listed-by-slug, placement-level hiding,
dish-in-many-categories, reorder atomicity, preview ≡ resolver output, inactive-employee banner
data present (D-41), hard-delete category/item allowed.
Frontend: no business-logic tests (PDF §7); type/lint/build gates + manual checklist (§9).
Pure shared tests also run under `pnpm test:tz` (TZ=UTC + America/Los_Angeles) per testing skill.

## 8. New ambiguities with proposed D-entries (append at Close only if approved; numbered from D-82 per prompt)

| ID | PDF § | Ambiguity | Decision | Why | Alternative |
|----|-------|-----------|----------|-----|-------------|
| D-82 | 4.3 | Clearing a typed price in the grid | Deletes the row; effective falls back to derived/NONE | Least inventive "override removed" reading | Store null/zero |
| D-83 | 4.2 | Preview "as a given employee" picker | Any active employee selectable; inactive allowed with banner (D-41) | Literal + D-41 | Active-only list |
| D-84 | 4.2 | Slug generation | Slugify name, unique numeric suffix on clash | Deterministic, matches secret-link use | Hand-typed slugs |
| D-85 | 4.5 | CSV shape | Header `name,email` required, UTF-8, ≤1000 rows | Mirrors D-31 minimally | Sniff columns |
| D-86 | 4.3 | First tier default | First created tier auto-becomes default; no tier delete (deactivate only) | "One tier is the default" must hold from tier one | Manual default assignment |
| D-87 | 4.4 | `store` vs `store.craftlytech` reference path | Read `store.craftlytech` | Only candidate present | — |

## 9. Gate + files + manual checks

Gate: `pnpm check-types && pnpm lint && pnpm test` + `pnpm --filter api prisma generate`;
zero warnings; no `any`/`!`/non-null silencing; header comments on domain fns.
Files: §3 lists (shared: `pricing.ts`, `calendar.ts`, `schemas/{pricing,companies,employees,menu,catalogue}.ts`,
`errors.ts` additions; api: `modules/{pricing,catalogue,companies,employees,menu}` ×
(module/controller/service/domain/dto/spec); web: 4 routes + `features/{pricing,companies,employees,menu}`
+ 4 hooks + `components/data-table.tsx` + nav entries + CLI components).
Manual checklist (user runs): login as admin; tiers CRUD + default swap + rule editor math
(2.4×310=745, +15% on 184=215); grid shows MANUAL/DERIVED/NONE + missing filter; batch save +
clear-to-derived; company+owner create; duplicate/public domain rejects; address default swap;
calendar edit; employee CRUD + flags + allergies; move employee (no orders → allowed, guard noted);
categories/secret slug/multi-placement/hiding/reorder; preview matches employee view; CSV last
(5 rows, 3 bad → 2 imported + row errors).

## 10. Audit traceability (appended per docs/AUDIT.md; iteration 2: zero contradictions)

| Plan item | Source |
|---|---|
| Tiers CRUD, one default, default swap in tx | PDF 4.3.1–2; skill pricing tier rules |
| Rule editor COST/TIER, cycle/depth/self checks | PDF 4.3.6; skill; D-16 |
| Integer math, ceil-to-5, typed unrounded | PDF §7; skill; D-10, D-11, D-12 |
| Resolver + no fallback + dish>0 / option≥0 | PDF 4.3.4–5; skill; D-13, D-14, D-15 |
| Grid MANUAL/DERIVED/NONE, missing filter, batch tx | PDF 4.3.7; skill |
| Grid clear deletes row (D-82 proposed) | Ambiguity, least inventive |
| First-tier default, no tier delete (D-86 proposed) | Ambiguity; "one tier is the default" |
| Company+owner one tx, owner immovable (D-18) | PDF 4.4; D-18 |
| Domains unique/public-block/≥1; email unchecked | PDF 4.4; D-19, D-20 |
| Billing contact required (D-32); name non-unique (D-33) | Decisions |
| Addresses ≥1, one default, never hard-delete | PDF 4.4; schema relations |
| Calendar model + `isCompanyDeliveryDay`; edits unblocked | PDF 4.4; D-26, D-27 |
| Delivery defaults ranges; default-driver eligible | PDF 4.4; skill; D-30 validated on set |
| Tier link optional; hidden-set replace in tx | PDF 4.4/4.3/4.2; skill hide rule |
| Employees CRUD, flags default false, stored-only prefs | PDF 4.5; D-22, D-25 |
| Email globally unique lowercase; no hard delete | PDF 4.5; D-21; schema |
| Move guard implemented now (prompt said Group 3; deviation flagged §1.5) | D-29 |
| CSV columns/shape/batch-valid/insert-valid, last | PDF 4.5 [Should]; D-31; D-85 proposed |
| Categories order/active/secret+slug; multi-placement | PDF 4.2; D-34, D-35; D-84 proposed |
| Reorder atomic bulk; hard delete allowed | Skill; D-40 |
| MenuResolver six rules; preview = employee view | PDF 4.2; skill; D-36..D-39, D-41; D-83 proposed |
| Reference path `store.craftlytech` | Assumption §1 (D-87 proposed) |
| Catalogue prerequisite scope | Scope addition, approval required §1.1 |
| `GET /staff/drivers` minimal picker | Scope addition, approval required §1.10 |
| AGENTS §§12–15 / §12 components / §13 logging | Do not exist; substitutes in §1.2, no new dep |
| D numbering from D-82; D-80/D-81 unused | Prompt-directed; gap noted, not reused |

Beyond the PDF: none. Every item traces to PDF, schema, skill, or a proposed D-entry above.
