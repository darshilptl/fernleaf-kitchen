# AGENTS.md: Fernleaf Kitchen Admin Panel

Heizen engineering assignment. Reviewers grade rules, the data model and correctness above screens.
Correctness beats completeness.

## 0. Sources of truth (priority order)

1. `docs/assignment.txt`: the only definition of scope.
2. `apps/api/prisma/schema.prisma` and `prisma/migrations/*_constraints/migration.sql`: the data model.
   Never change either without explicit approval.
3. `docs/DECISIONS.md`: every ambiguity decision (D-xx).
4. `.agents/skills/*/SKILL.md`: exact algorithms. Read the matching skill BEFORE touching its area.

## 1. Hard rules (no exceptions)

1. Build only what the PDF requires. No extra features, endpoints, columns, libraries or abstractions.
   If something extra seems needed: STOP, flag it, wait for approval.
2. Never assume silently. PDF silent or ambiguous -> choose the least inventive reading, append an entry
   to `docs/DECISIONS.md` BEFORE writing code, and state it in the module plan (skill: ambiguity-log).
3. Unclear instruction, or two rules conflict -> STOP and ask. Never guess.
4. Every rule lives in exactly ONE function (see section 7). Re-implementing a rule elsewhere is a bug.
5. The server enforces every rule. The UI only reflects server state.
6. No dead code, no commented-out code, no TODO without a plan or DECISIONS entry.

## 2. Architecture boundaries

- NestJS (`apps/api`): ALL business logic, validation, permissions, the database. Only place that imports Prisma.
- Next.js (`apps/web`): UI only. No Prisma, no database credentials, no server actions containing logic.
  Browser -> `/api/*` (Next rewrite) -> NestJS. Auth cookie is first-party through that rewrite.
- `packages/shared`: pure TypeScript with no framework or database imports: permission keys, enums, money,
  time, cut-off, calendar, price math, Zod schemas, error codes. Both apps import from here.
- Rule of placement: if the frontend needs it for validation or preview -> `packages/shared`.
  Otherwise -> the api module's `domain/` folder.

## 3. Repo structure and naming

```
apps/api/src/
  main.ts  app.module.ts
  common/    guards/ decorators/ filters/ pipes/ errors/ clock/
  database/  prisma.service.ts
  modules/<module>/
    <module>.module.ts  <module>.controller.ts  <module>.service.ts
    domain/   pure functions only (no Nest, no Prisma), one concept per file
    dto/      Zod schemas re-exported from packages/shared + inferred types
    *.spec.ts colocated tests
apps/api/prisma/{schema.prisma, migrations/, seed/}
apps/web/src/
  app/        routes only (thin pages)
  components/ui/       shadcn components (never hand-built replacements)
  features/<module>/   components, hooks, view-models for that module
  hooks/      shared data hooks   lib/  api client, utils   styles/globals.css (design tokens)
packages/shared/src/{permissions, enums, money, time, cutoff, calendar, pricing, schemas/<module>, errors}
```

- Files: kebab-case with role suffix (`order-state-machine.ts`, `orders.service.ts`, `create-order.schema.ts`).
- Types/classes PascalCase, no `I` prefix. Zod schema `createOrderSchema`, inferred type `CreateOrderInput`.
- Functions camelCase `verbNoun`. Booleans `is/has/can`. Constants SCREAMING_SNAKE.
- Money variables end in `Cents` (integers only). Calendar dates are `YYYY-MM-DD` strings in code.
- API: REST, kebab-case plural nouns under `/api`, actions as sub-resources (`POST /orders/:id/place`).
- Error codes SCREAMING_SNAKE (`ORDER_CUTOFF_PASSED`). DB: snake_case via `@@map` (already in schema).
- Named exports only (default exports only where Next.js requires them).

## 4. Backend code standard

1. TypeScript strict, `noUncheckedIndexedAccess` on, zero `any`, no `!` non-null assertion, no `as` casts to
   silence errors. Use `unknown` plus narrowing. Exhaustive switches end in `assertNever`.
2. Layers: controller (parse + permission + call) -> service (orchestrate, transaction, Prisma)
   -> domain functions (pure, take plain data and `now`, return plain data).
3. Pure domain functions never read the clock, DB, env, or random. `now: Date` is a parameter
   (`ClockService.now()` supplies it in services) so tests control time.
4. Input: every request body/query is parsed by a shared Zod schema in a pipe. Never validate by hand.
5. Errors: services/domain throw only `DomainError({ code, path?, message, httpStatus })`. One filter maps
   `DomainError` and Zod errors to the response shape `{ code, path, message }[]`. Never throw raw `Error`
   or `HttpException` from business code.
6. Transactions: `prisma.$transaction(async (tx) => ...)`. Every multi-write operation is one transaction.
   No nested transactions. Concurrency uses conditional updates and row locks (skill: orders, kitchen-dispatch).
7. Money: integer cents only. Parse/format through `packages/shared/money`. Never `Number("7.45") * 100`.
8. Comments: every non-trivial function carries a header comment (template below). Comments explain the
   algorithm and the WHY, cite the PDF section, and list invariants and edge cases. Never narrate trivial
   lines. Never leave commented-out code.

```ts
/**
 * <one-line purpose>. PDF §<section> / D-<id>.
 *
 * Algorithm:
 *   1. ...
 *   2. ...
 * Invariants: ...
 * Edge cases: ...
 */
```

9. Lint/type gates must pass with zero warnings.

## 5. Frontend code standard

1. Strict TypeScript, zero `any`.
2. Crystal-clean logic and flow. Components render. Logic lives in hooks and `packages/shared`.
3. Linear-grade UI/UX: whitespace discipline, typography hierarchy, restrained colour.
4. Typography follows the Linear standard strictly. Size, weight, line-height and tracking come ONLY from
   tokens in `styles/globals.css`. Never introduce a value outside the scale.
5. Design tokens: every colour, spacing, radius, shadow, font and duration comes from `globals.css`
   tokens. No hardcoded colours, no arbitrary Tailwind values (`w-[13px]`, `text-[#abc]`).
6. Use shadcn components (`components/ui`) instead of building your own. Extend by composition only.
7. Libraries: Motion (`motion/react`) for animation, `react-hook-form` + `@hookform/resolvers` for forms,
   `zod` for ALL validation, the installed Base UI toast (`ui/toast.tsx`, `toast` manager) for toasts,
   `next-themes` only if a theme requirement is explicitly approved (default: light only).
8. Forms: every user input has a Zod schema (from `packages/shared`) -> inferred TS type ->
   `react-hook-form` with `zodResolver`. Never validate by hand inline.
9. Data fetching and shared behaviour live in custom hooks under `src/hooks/` (TanStack Query allowed
   inside hooks only). No `useEffect` fetching inside components. Functional components only.
10. One API client (`lib/api-client.ts`). It parses the `{ code, path, message }[]` error shape and maps
    `path` to form fields.
11. Hiding a button by permission is UX only. The server decides. Never compute "today", cut-off, price or
    totals in the browser except through `packages/shared` helpers for previews.
12. Driver screens are mobile-first.

## 6. Non-negotiable invariants (details in skills)

1. Permissions are string keys. Code never checks a role name. (auth-permissions)
2. Ownership is enforced inside the query. Another driver's drop -> 404. (auth-permissions)
3. Money is integer cents. Derived prices round UP to a multiple of 5 cents. (pricing)
4. An order snapshots names and prices. Catalogue/price edits never change it. (orders)
5. Price resolution and menu availability each have ONE function. (pricing, catalogue-and-menu)
6. A dish with no price on the employee's tier never appears (never $0, never blank). (pricing)
7. Combination quantities sum exactly to the line quantity. Combinations are distinct. (orders)
8. Orders change `status` only through `transitionOrder()`. (orders)
9. Locking is computed from the clock (`now >= cutoffInstant`), never from a stored flag. (time-and-cutoff)
10. Cut-off processing is idempotent and has a manual trigger. (orders, time-and-cutoff)
11. The company calendar never affects the cut-off. Only the kitchen calendar does. (time-and-cutoff)
12. One kitchen time zone (`Asia/Kolkata`). "Today" only via `kitchenToday()`. (time-and-cutoff)
13. Kitchen unit and dispatch steps use conditional updates under a parent row lock. (kitchen-dispatch)
14. Dispatch steps apply to a whole drop in one transaction. (kitchen-dispatch)
15. An order is on at most one invoice. Invoiced orders cannot be cancelled or rejected. (billing)
16. Seed data is date-relative, idempotent, and never leaves Draft/Placed orders on past-cut-off dates. (seed-demo-data)
17. Nothing is hard-deleted where history depends on it (dishes, options, companies, employees, addresses,
    tiers, orders, invoices). (all)
18. Every ambiguity is logged in `docs/DECISIONS.md`. (ambiguity-log)

## 7. Single owners (never duplicate)

| Rule                                       | Owner                                                |
| ------------------------------------------ | ---------------------------------------------------- |
| Money parse/format/round                   | `packages/shared/money`                              |
| Cut-off instant, lock check                | `packages/shared/cutoff`                             |
| Kitchen "today", local<->UTC, date helpers | `packages/shared/time`                               |
| Company delivery-day check                 | `packages/shared/calendar`                           |
| Planned times, lateness                    | `packages/shared/kitchen-plan`                       |
| Combo key, order totals                    | `packages/shared/pricing`                            |
| Dish/option price resolution               | `apps/api/.../pricing/domain`                        |
| Menu availability                          | `MenuResolver.resolveForEmployee`                    |
| Order draft validation                     | `apps/api/.../orders/domain/validate-order-draft.ts` |
| Order status changes                       | `transitionOrder()`                                  |
| Permission check                           | `PermissionGuard` + `@RequirePermission()`           |

## 8. Module workflow (mandatory order, backend AND frontend)

For every module:

1. **Explore**: read the PDF section, the skill, the schema models, DECISIONS, and the existing scaffold.
   Frontend: also the tokens in `globals.css` and `components.json` aliases (`@/*`).
2. **Review**: list anything in the PDF, skill or decisions that constrains this module. If any code is
   reused from an older project, audit it against sections 1 to 5 first and flag every violation
   (hardcoded colours, arbitrary values, `any`, class components, dead or commented code, broken links,
   weak typography or spacing).
3. **Plan**: write ONE `docs/modules/<module>/implementation.md` covering (a) what was flagged,
   (b) what must be built, (c) exact implementation: files and paths, functions and signatures,
   endpoints and DTOs (backend) or tokens, components, hooks and Zod schemas (frontend), tests,
   and every new ambiguity with its proposed D-entry.
4. **Wait**: do NOT implement until the user explicitly approves the plan.
5. **Execute**: implement exactly the approved plan. No scope creep.
6. **Gate**: run `pnpm tsc --noEmit` (or `npx tsc --noEmit`), `pnpm lint`, and for the backend also `pnpm test`
   and `pnpm prisma validate`. Fix every error before declaring done. Do not assume. Ask if unclear.
7. **Close**: append approved D-entries to `docs/DECISIONS.md` and commit.

## 9. Git, deployment, README

- Small commits, one logical step each, Conventional Commits (`feat(orders): add place transition`).
  The reviewers read the history. Never squash into a few big commits.
- Render build: install, `prisma generate`, build. Start: `prisma migrate deploy` then `node dist/main`.
  Listen on `process.env.PORT`, host `0.0.0.0`. Expose `/api/health`.
- README (required by the PDF): setup, architecture and data model diagram, key decisions and trade-offs,
  dashboard definitions, prioritisation notes (built, skipped and why, next steps, ambiguities).
- The live app must keep running two weeks after submission and contain realistic data (skill: seed-demo-data).
