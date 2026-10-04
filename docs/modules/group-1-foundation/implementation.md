# Group 1 foundation — modules 0, 1, 2 (backend + frontend)

Status: COMPLETE (verified by the user).

PDF sections: 2 (stack, live deploy, data), 3 (roles/permissions), 4.1 (catalogue Must only), 4.2 (deferred — noted only), 4.10 (settings row only), 7 (money/timezone/concurrency/validation/pagination/lint/type/tests), 8 (deliverables).
Skills read: module-workflow, auth-permissions, catalogue-and-menu (Must subset), frontend-standards, ambiguity-log. Pricing/time-cutoff touched only for constants placement, not implemented.
Decisions touched: D-01, D-02, D-03, D-04, D-43 (Asia/Kolkata constant home, not implemented here), D-75 (Admin excludes deliveries.assignable), D-39/D-35 (deferred to menu module), D-77 (approved: demo marker = inactive system staff `seed@fernleaf.test` as creator + known seed keys; no schema change). D-01–D-76 frozen; DECISIONS.md overrides skill prose. At the checkpoint this plan appends D-78 (staff passwords minimum 8 characters; PDF silent) and D-79 (the four seed accounts are re-asserted on every boot: password, role, active).
Source of truth: `docs/assignment.txt` is canonical.

> Execution order: Spike → Module 0 → Module 1 → CHECKPOINT (stop, review, deploy) → Module 2 → Module 1b (staff management). No code until this plan is approved. Any new need = stop and re-plan.

## 1. Flags from review (conflicts, risks)

1. `packages/shared` does not exist; every skill imports from it. Must be created before anything else. No framework/DB imports inside it.
2. `apps/web/tsconfig.json:23-29` maps `@repo/validators, types, db, auth, email, ai` — none exist. Only `@/*` + `@repo/ui/*` are real. Stale paths will be removed.
3. `apps/web/src/app/globals.css` is READ-ONLY (user order). It registers dense sizes as `--font-size-*` under `@theme inline`; the skill's `text-card-title` smoke test may fail. On failure we STOP and report — we do not edit the file.
4. User owns shell/login visuals/dashboard layouts: `src/app/layout.tsx` (Navbar + ThemeProvider), `src/components/Navbar.tsx`, `src/components/sections/login-form.tsx` visuals, future dashboard layouts. We wire logic only (RHF + schema + hooks + server guard), no restyle, no token invention.
5. `ui/toast.tsx` will be supplied by the user. We add no toast system; unmapped server errors are rendered as form-root/server text until the toast file lands (explicit gap, no workaround built).
6. shadcn additions only via `shadcn` CLI. Needed in this group: `empty`, `skeleton` (placeholder landing pages + loading states). No hand-built replacements.
7. `apps/api` ESM (`package.json:8 moduleFormat esm`, nodenext, `.js` suffix imports) + `emitDecoratorMetadata:true` + Vitest/esbuild (no decorator metadata) is unverified. The spike proves it before module work.
8. Env split: runtime `DATABASE_URL` (pooled) vs CLI `DIRECT_URL` (prisma.config.ts) vs `TEST_DATABASE_URL` (separate Supabase project, session pooler string, lives in `apps/api/.env`). Tests must throw if `TEST_DATABASE_URL === DATABASE_URL`.
9. Portions are PDF [Should] and workflow says build last. Module 2 in this group is Must-only: `usesPortions` is forced `false`; any size payload is rejected. The portion invariant is enforced as "no portion rows allowed yet".
10. Menu (4.2), pricing (4.3), companies/employees (4.4/4.5) are NOT in this group. Module 2 exposes catalogue only; `MenuResolver`, tier math, and company hiding arrive in their groups. No menu/preview endpoints here.
11. Reused code audit (AGENTS.md §§1–5): `login-form.tsx` is presentational only (no validation, no submit wiring) — keep visuals, add RHF wiring. `Navbar.tsx:13` has a TODO with a hardcoded GitHub URL — out of scope, left untouched. `page.tsx` renders nothing — replaced only by role placeholder pages listed below. `lib/utils.ts` re-exports `cn` — kept as-is.

## 2. Scope

### Module 0 — scaffold + packages/shared + skeleton deploy (Must: §2 stack/HTTP, §7 lint/type, §8 repo)
- Create `packages/shared` (permissions, errors, auth schema, env-safe helpers only as needed).
- Fix gates: api `noUncheckedIndexedAccess`, oxlint `no-explicit-any=error`, Zod-validated `apps/api/src/config/env.ts`, root `check-types/lint/test` scripts + turbo `test` task.
- Web: remove stale tsconfig paths; add `react-hook-form, @hookform/resolvers, zod, @tanstack/react-query`; add `GET /health` on the API.
- HTTP wiring (stated once): Nest sets a global prefix `api`, so routes are `/api/...` on the Nest side. Next rewrites `/api/:path*` → `${API_URL}/api/:path*`. The `(staff)` server layout fetches the absolute `API_URL` address and forwards `cookies()` (async) — never a relative `/api/...` fetch without forwarded cookies.
- Spike (must pass before modules 1–2): Nest ESM build+start; pure-function Vitest spec written against real shared code (no throwaway helper); `PrismaService` constructed with an injectable connection string against TEST_DATABASE_URL (`SELECT 1`); `check-types` clean. Spike scaffolding is deleted after it passes (no dead code stays; the surviving specs are the real shared-code specs listed in §8). AuthService specs come with module 1, not the spike.
- [Should]: none in module 0.

### Module 1 — auth, staff, roles (Must: §3 + §2 accounts/live login)
- `ensureBaseData()`: permission-key sync, 4 roles (Admin = all except `deliveries.assignable`), 4 exact accounts (`Test@1234`), settings row id=1. Idempotent; runs on boot; reused by tests.
- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` → `{ id, name, email, permissions, landingPath }` where `landingPath = user.role.landingPath` read from the DB row. No precedence/fallback logic anywhere: no role-name checks, no permission-inference mapping. JWT = user id only, httpOnly cookie, 12h, lax, secure in production. bcryptjs. Same message for unknown email vs wrong password.
- `PermissionGuard` + `@RequirePermission()`; request attaches `{ id, permissions }`. No role-name checks.
- Frontend: wire existing login UI to `loginSchema` + RHF; `use-session` hook; server-guarded staff layout with `landingPath` redirects; logout; permission-keyed nav config (UX only); placeholder landing pages per role with shadcn `Empty`, no numbers.
- [Should]: none. Staff CRUD is module 1b (after module 2), not module 1.

### Module 2 — reference data + catalogue Must-only (Must: §4.1 minus portions; §5 deactivation rule)
- Reference lists: allergens, dietary tags, kitchen stations, portion sizes (list only — no sizes sold yet), packaging types. Trimmed names, case-insensitive uniqueness (DB), deactivate-never-delete; station deactivation blocked while an active dish uses it.
- Dishes: name, description, imageUrl (URL only, no upload), sku unique, temperature, costCents ≥ 0, station?, minOrderQuantity?, isActive. Options: name, description, costCents ≥ 0, isActive. Groups belong to one dish; single-choice; required = exactly-one semantics enforced at order time (later group), stored as `isRequired + sortOrder + usesPortions:false`.
- `sku`/`costCents` never exposed to employee views (no employee view in this group; rule enforced by not adding such endpoints).
- [Should] portions: explicitly deferred. `usesPortions:true`, `OptionGroupPortion`, `OptionPortion` writes are rejected with `CATALOGUE_PORTIONS_DEFERRED` until the [Should] pass.
- Module 2 minimal frontend (after the checkpoint): reference-lists page (tabs per list, create inline, deactivate/activate inline), dishes table (server pagination) with a sheet form for create/edit, groups and options managed inside the dish sheet. Money inputs use shared parse/format helpers (see Files).

### Module 1b — staff management, after module 2 (Must: §3 staff accounts + auth skill staff rules)
- Backend: `GET /staff` (server-paginated `page`, `pageSize` max 100, minimal filters only as needed for the table), `POST /staff` (name, lowercase email, roleId, temp password), `PATCH /staff/:id/role` (change role), `POST /staff/:id/deactivate` + `POST /staff/:id/activate`. All require `staff.manage`. Self-deactivation blocked (`STAFF_SELF_DEACTIVATE` 409). Deactivation clears `Company.defaultDriverId` rows pointing at that user in the same transaction. Exactly one role per user; emails lowercased; `role.key` seeding-only, never used in guards.
- Frontend: minimal staff table (server pagination) + create/change-role dialog using shadcn components via CLI only (`table`, `dialog` in addition to the `empty`/`skeleton` already added; reuse `button`, `input`, `field`). No extra CRUD polish beyond the table + dialog.
- [Should]: none.

## 3. Files (exact paths; edit vs create)

Module 0 — create:
- `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/permissions.ts`, `packages/shared/src/errors.ts`, `packages/shared/src/money.ts` (parse/format integer-cents helpers for module 2 frontend; string handling only, no floats), `packages/shared/src/schemas/auth.ts`, `packages/shared/src/index.ts`
- `apps/api/src/config/env.ts`, `apps/api/src/common/errors/domain-error.ts`, `apps/api/src/common/filters/domain-exception.filter.ts`, `apps/api/src/common/pipes/zod-validation.pipe.ts`, `apps/api/src/health/health.controller.ts`
- `apps/api/vitest.config.ts` (edit: load `apps/api/.env`, `globalSetup: ./test/global-setup.ts`, `fileParallelism: false` — all specs share one database), `apps/api/test/global-setup.ts` (create: run `prisma migrate deploy` with `DIRECT_URL` overridden to `TEST_DATABASE_URL`), `apps/api/test/db.ts` (TEST_DATABASE_URL guard + truncate-all-business-tables helper run per spec file)
- Spike specs written against real shared code (no throwaway helpers; scaffolding deleted after the spike passes — see §8)
- `apps/web/src/lib/api-client.ts`, `apps/web/src/hooks/use-session.ts` (added in module 1, listed here so the module 0 wiring unblocks it)
Edits:
- `apps/api/tsconfig.json` (add `noUncheckedIndexedAccess:true`), `apps/api/.oxlintrc.json` (`no-explicit-any:error`), `apps/api/src/main.ts` (cookie-parser, env.ts, global prefix `api`, host `0.0.0.0`, PORT), `apps/api/src/app.module.ts` (Config-less: import Health + Auth + Catalogue (+ Staff in 1b) modules as added), `apps/api/src/database/prisma.service.ts` (edit: constructor takes an injectable connection string, defaults to env `DATABASE_URL`; use env.ts, remove `!`)
- `package.json` (add `"test": "turbo run test"`), `turbo.json` (add `test` task, `check-types` already present), `apps/web/package.json` (add 4 deps), `apps/web/tsconfig.json` (delete stale `@repo/validators/types/db/auth/email/ai` paths), `apps/web/next.config.js` (rewrite `/api/:path*` per wiring above)
- shadcn CLI additions into `packages/ui/src/components/ui/`: `empty`, `skeleton` in module 1; `table`, `dialog` in module 1b. Nothing else.
Never touched: `apps/web/src/app/globals.css`, `docs/DECISIONS.md` (append-only; no entry in this plan), `apps/api/prisma/schema.prisma`, `prisma/migrations/*`, user shell visuals.

Module 1 — create:
- `apps/api/src/modules/auth/auth.module.ts`, `auth.controller.ts`, `auth.service.ts`, `domain/authenticate.ts` (pure credential-decision helper, takes found-user + compare result + now), `dto/login.schema.ts` (re-export shared), `auth.decorator.ts` (`@RequirePermission` + `@CurrentUser`), `guards/permission.guard.ts`, `base-data.ts` (`ensureBaseData()`), `base-data.spec.ts`, `auth.service.spec.ts`
- `apps/web/src/app/login/page.tsx` (edit: wire existing `LoginForm` visuals), `apps/web/src/components/sections/login-form.tsx` (edit: add RHF wiring only), `apps/web/src/hooks/use-session.ts`, `apps/web/src/lib/nav.ts` (permission-keyed nav config), `apps/web/src/app/(staff)/layout.tsx` (server guard + landingPath redirect; fetches absolute API_URL, forwards async `cookies()` — per wiring above), `apps/web/src/app/(staff)/admin/dashboard/page.tsx`, `apps/web/src/app/(staff)/kitchen/dashboard/page.tsx`, `apps/web/src/app/(staff)/dispatch/dashboard/page.tsx`, `apps/web/src/app/(staff)/driver/page.tsx` (Empty placeholders under the `(staff)` guard, no numbers)
Module 1b — create:
- `apps/api/src/modules/staff/staff.module.ts`, `staff.controller.ts`, `staff.service.ts`, `dto/*.schema.ts` (re-exports of shared staff schemas), `*.spec.ts` colocated
- `packages/shared/src/schemas/staff.ts` (create/role-change/list-query schemas)
- `apps/web/src/app/(staff)/admin/staff/page.tsx` (minimal table, server pagination) + `apps/web/src/features/staff/staff-dialog.tsx` (create / change-role dialog, RHF + shared schemas)
Module 2 — create:
- `apps/api/src/modules/catalogue/catalogue.module.ts`, `catalogue.controller.ts`, `catalogue.service.ts`, `domain/catalogue-validation.ts` (pure: trim/name checks, Must-only portion gate), `dto/*.schema.ts` (re-exports of shared catalogue schemas), `*.spec.ts` colocated
- `packages/shared/src/schemas/catalogue.ts` (reference-data + dish/option/group schemas)
- Frontend (after checkpoint): `apps/web/src/app/(staff)/admin/catalogue/page.tsx` (reference-lists page: tabs per list, inline create, deactivate/activate) + `apps/web/src/app/(staff)/admin/dishes/page.tsx` (dishes table, server pagination) + `apps/web/src/features/dishes/dish-sheet.tsx` (sheet form for create/edit; groups and options managed inside the sheet; money fields via shared parse/format). shadcn via CLI only (`tabs`, `sheet` in addition to module 1/1b components).

## 4. Domain functions (pure; `now: Date` param where time matters; header comment per AGENTS.md §4.8)

- `authenticate(input: { userFound: boolean; passwordMatches: boolean; isActive: boolean }): { ok: true } | { ok: false; code: 'AUTH_INVALID_CREDENTIALS' | 'AUTH_INACTIVE' }` — single place deciding login outcome so controller returns identical message for unknown-email vs wrong-password. Invariants: no timing leak via message; inactive never yields token. Edge: userFound=false still runs compare against dummy hash at service layer (constant-time hygiene, not in pure fn). (`me` landingPath is read straight from `user.role.landingPath`; there is no landing-path resolver function.)
- `validateReferenceName(name: unknown): string` — trim + non-empty + length cap; DB enforces case-insensitive uniqueness. Edge: whitespace-only rejected.
- `validateCatalogueMustOnly(dish, groups): void` — rejects `usesPortions:true`, any `sizes` payload, negative `costCents`, empty group options config at type level; throws DomainError `CATALOGUE_PORTIONS_DEFERRED` for portion attempts. Edge: portion-size rows may exist from seed reference list but no group may reference them.
- Shared helpers: `PERMISSIONS` (const list + `PermissionKey` type), `DomainError` shape, `loginSchema` (email trim+lowercase+max 254, password min 1 — length policy is format-only since accounts are fixed), catalogue Zod schemas (name/sku/temperature/cost/sortOrder flags).

## 5. Endpoints (Zod pipe; `{ code, path, message }[]` errors; HTTP wiring per §2)

| Method + path | Permission | Request schema (shared) | Response | Error codes |
|---|---|---|---|---|
| `GET /health` | public | — | `{ ok: true }` | — |
| `POST /auth/login` | public | `loginSchema { email, password }` | `me { id, name, email, permissions, landingPath }` + Set-Cookie | `AUTH_INVALID_CREDENTIALS` 401 (same for unknown/wrong), `AUTH_INACTIVE` 401 |
| `POST /auth/logout` | public (clears cookie even if expired) | — | `{ ok: true }` + clear cookie | — |
| `GET /auth/me` | authenticated (no key; 401 if missing/inactive) | — | `me` (`landingPath` = `user.role.landingPath`) | `AUTH_REQUIRED` 401 |
| `GET /reference/:list` (`allergens\|dietary-tags\|stations\|packaging-types\|portion-sizes`) | `catalogue.read` | query `{ active?: boolean }` | array | `PERMISSION_DENIED` 403 |
| `POST /reference/:list`, `PATCH /reference/:list/:id` | `catalogue.manage` | `{ name, sortOrder? }` | row | `REFERENCE_DUPLICATE` 409, `REFERENCE_IN_USE` 409 (station), `PERMISSION_DENIED` 403 |
| `POST /reference/:list/:id/deactivate`, `POST .../activate` | `catalogue.manage` | — | row | same as above; `REFERENCE_LAST_ACTIVE` never applies (no minimum-count rule in PDF) |
| `GET /dishes`, `POST /dishes`, `GET /dishes/:id`, `PATCH /dishes/:id` | read: `catalogue.read`; writes: `catalogue.manage` | list query `{ page, pageSize (max 100), active? }`; dish schema (no portions) on writes | paginated dishes / dish + groups | `DISH_SKU_DUPLICATE` 409, `CATALOGUE_PORTIONS_DEFERRED` 409, `PERMISSION_DENIED` 403 |
| `GET /options`, `POST /options`, `PATCH /options/:id` | same as dishes | list query `{ page, pageSize (max 100), active? }`; option schema on writes | paginated options / option | `PERMISSION_DENIED` 403 |
| `POST /dishes/:id/groups`, `PATCH /groups/:groupId`, `DELETE /groups/:groupId` | `catalogue.manage` | group schema (`usesPortions` must be false; `sizes` must be absent/empty) | group | `CATALOGUE_PORTIONS_DEFERRED` 409, `PERMISSION_DENIED` 403 |
| `POST /groups/:groupId/options` (attach), `DELETE /groups/:groupId/options/:optionId` | `catalogue.manage` | `{ optionId, sortOrder? }` | group | `CATALOGUE_OPTION_MISSING` 404, `PERMISSION_DENIED` 403 |
| `GET /staff` (module 1b) | `staff.manage` | query `{ page, pageSize (max 100) }` | paginated staff (id, name, email, roleId, isActive — never passwordHash) | `PERMISSION_DENIED` 403 |
| `POST /staff` (module 1b) | `staff.manage` | `{ name, email, roleId, password }` | staff row | `STAFF_EMAIL_DUPLICATE` 409, `PERMISSION_DENIED` 403 |
| `PATCH /staff/:id/role` (module 1b) | `staff.manage` | `{ roleId }` | staff row | `STAFF_NOT_FOUND` 404, `PERMISSION_DENIED` 403 |
| `POST /staff/:id/deactivate`, `POST /staff/:id/activate` (module 1b) | `staff.manage` | — | staff row | `STAFF_SELF_DEACTIVATE` 409, `STAFF_NOT_FOUND` 404, `PERMISSION_DENIED` 403 |

Cookie: `name=fnl_session; HttpOnly; Path=/; SameSite=Lax; Secure (prod only); Max-Age=43200`. JWT payload `{ sub: userId }`, `expiresIn 12h`, secret from `env.ts`. No refresh tokens.
Staff deactivation (module 1b): self-deactivation blocked; deactivation clears `Company.defaultDriverId` rows pointing at that user in the same transaction (auth skill rule).

## 6. Frontend (per frontend template §§2–7)

- Routes/layouts: keep user `app/layout.tsx` + `Navbar`. Edit `app/login/page.tsx` to render wired `LoginForm`. Add `(staff)/layout.tsx` (server component: fetch absolute API_URL `/api/auth/me` forwarding async `cookies()` — per wiring above; 401 → `/login?next=...`; authenticated on `/login` → own `landingPath`; landing mismatch → redirect to own `landingPath`). Add 4 placeholder pages under the guard, each: `h1 heading-sm` + `Empty` (title + `description-sm`, no metrics): Admin "Operations overview — coming in dashboards", Kitchen "Today's prep — coming in kitchen board", Dispatch "Today's drops — coming in dispatch", Driver "My drops for today — coming in driver view". Module 1b adds `(staff)/admin/staff/page.tsx` (minimal table, server pagination) + `features/staff/staff-dialog.tsx` dialog.
- Components (shadcn via CLI only): `empty`, `skeleton` in module 1; `table`, `dialog` added in module 1b. Reuse existing `button, field, input` in login visuals. No new design.
- Tokens (globals.css names only, file untouched): pages `bg-background`; panels `bg-background-panel`; cards `rounded-lg shadow-card`; titles `heading-sm`; body `description-sm`; form text `text-body-sm`; labels `font-medium`; errors `text-destructive`; gaps `gap-4/6/8`; borders `border-border`; inputs `border-input`. Typography: one H1 per page. No hex/arbitrary/`dark:` classes. If `text-card-title` smoke test fails → report, do not work around.
- Hooks/schemas: `use-session.ts` (`queryKey ['session']`, `GET /api/auth/me`, no `useEffect` fetching); `loginSchema` imported from `packages/shared`; `applyServerErrors(form, errors)` maps `path` (e.g. `email`) to fields; unmapped → root/server text (toast file pending from user). `lib/api-client.ts` parses `{ code, path, message }[]` and throws typed `ApiError`. Mutations: login invalidates `['session']`; logout clears it + router push `/login`.
- States: login (idle/submitting/invalid-credentials/inactive/disabled); session (loading → `Skeleton`; 401 → redirect; error → server text + retry); placeholders (static `Empty`, no loading). Permission-hidden nav is UX only (`nav.ts` filters by `permissions.includes(key)`); server enforces.
- Motion/a11y: no motion in this group. a11y: labels for both inputs (existing `FieldLabel`), `aria-invalid` + `aria-describedby` on errors, focus-visible global, one H1, full keyboard submit, `useReducedMotion` n/a.

## 7. Transactions, locks, concurrency

- `ensureBaseData()` is upsert-based and safe to run on every boot: roles by `key`, permissions by `(roleId, permission)` delete-stale + insert-missing in one transaction per role; accounts by lowercase email (update passwordHash/role/isActive to seed values so reviewer logins always work); settings row `id=1` insert-if-missing (never overwrite reviewer-edited cut-off values). Parallel boots: unique constraints + `upsert` make the second a no-op.
- Staff deactivation (module 1b): `UPDATE staff_users SET isActive=false WHERE id AND id != actorId` conditional + `UPDATE companies SET defaultDriverId=NULL WHERE defaultDriverId=userId` in the same transaction; self-match affects 0 rows → `STAFF_SELF_DEACTIVATE` 409.
- Catalogue writes that touch link tables (group + options attach, reorder) run in `prisma.$transaction`; reorder = single bulk update; no nested transactions. Concurrency tests: duplicate SKU/name (one 409), double deactivate (idempotent), group attach races (unique violation → 409).
- Auth login performs no multi-write; no locks needed. Cookie set is response-only.

## 8. Tests (one behaviour per test, named by rule; Vitest `*.spec.ts` beside code; real Postgres via TEST_DATABASE_URL)

Spike (module 0, must pass first; scaffolding deleted after pass, no dead code):
- Pure-function spec written against real shared code (e.g. `loginSchema` trims/lowercases email; `PERMISSIONS` contains the auth-skill keys) — proves the Vitest runner + `packages/shared` import path with no throwaway helper.
- Construction spec: `new PrismaService(TEST_DATABASE_URL)` (injectable connection string, no Nest DI) against TEST_DATABASE_URL (`SELECT 1`); asserts the guard throws when `TEST_DATABASE_URL === DATABASE_URL`. AuthService specs come with module 1, not the spike.
Module 1:
- `ensureBaseData creates exactly the four accounts admin@test.com, kitchen@test.com, dispatch@test.com, driver@test.com, each logs in with Test@1234, each holds only its role's permission set, and a second run changes nothing`
- `rejects unknown email and wrong password with the same code and message`
- `refuses inactive user even with correct password`
- `me returns role landingPath from the DB row and 401 without cookie`
- `permission guard denies missing key with PERMISSION_DENIED and never checks role names`
- `admin role reseeds without deliveries.assignable when a new key appears`
- `login lowercases email before lookup`
Module 2:
- `trims reference names and rejects blank`
- `rejects duplicate reference name case-insensitively`
- `refuses to deactivate a station used by an active dish`
- `rejects usesPortions:true with CATALOGUE_PORTIONS_DEFERRED`
- `rejects duplicate dish sku`
- `dishes and options deactivate instead of deleting`
- `dish/option lists paginate with pageSize capped at 100`
Module 1b (after module 2):
- `refuses staff list/create/role-change/deactivate without staff.manage`
- `blocks self-deactivation with STAFF_SELF_DEACTIVATE`
- `deactivation clears Company.defaultDriverId in the same transaction`
- `rejects duplicate staff email (case-insensitive) with STAFF_EMAIL_DUPLICATE`
- `role change to unknown role returns STAFF_NOT_FOUND or validation error, never a role-name check`
Timezone: Group 1 has no date logic; full `TZ=UTC` + `TZ=America/Los_Angeles` matrix starts with time-and-cutoff group.

## 9. Gate checklist (per module; report outputs)

- `pnpm check-types` (root turbo) clean; `pnpm lint` (turbo: oxlint error on `any`, eslint `--max-warnings 0`) clean; `pnpm test` (turbo) green under `TEST_DATABASE_URL`; `pnpm --filter api prisma generate` clean.
- Spike evidence captured: `nest build` + `node dist/main` boot log, both spike specs green, `check-types` clean.
- No `any`, no `!` (env.ts validated), no role-name checks, no globals.css edit, no hand-built shadcn, no new D-entries.

## CHECKPOINT — after module 1, before module 2

STOP. Do not start module 2 until the user reviews and approves. Deliver for review:
1. Spike results + gate outputs.
2. Live deploy of skeleton + auth (login/logout/me + guard + 4 accounts + placeholders) with `/api/health` reachable.
3. Server-guarded staff layout + landingPath redirects + permission-keyed nav demonstrated on the 4 placeholder pages.
Deploy command uses `DATABASE_URL`/`DIRECT_URL` per environment; reviewer logins are the 4 seed accounts. Module 2 begins only on explicit approval.

## 10. Deployment checklist (hand to the user at the checkpoint; no new file)

- Render (API): build = install (`pnpm install`) + `prisma generate` + build (`nest build`); start = `prisma migrate deploy` then `node dist/main`. Env: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `NODE_ENV=production`, `PORT`. Listens on `process.env.PORT`, host `0.0.0.0`. Exposes `/api/health` (global prefix `api` + `GET /health`).
- Vercel (web): root directory `apps/web`. Env: `API_URL` (absolute Nest URL the `/api/:path*` rewrite targets). No database env on the web side.
- Checkpoint Close: append D-78 (staff passwords minimum 8 characters; PDF silent) and D-79 (the four seed accounts are re-asserted on every boot: password, role, active) to `docs/DECISIONS.md`, then commit in small Conventional Commits.
