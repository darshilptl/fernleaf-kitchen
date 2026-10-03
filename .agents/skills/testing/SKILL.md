---
name: testing
description: Use when writing or running any test. Defines runners, the real-database rule, fake clock, concurrency test pattern, timezone matrix, and the required test index.
---

# Testing (PDF section 7: "Test the business rules most likely to break")

## Runners and layout

- `packages/shared`: Vitest, pure functions, no database. Files `*.spec.ts` beside the code.
- `apps/api`: Jest (Nest default). Domain functions: pure unit tests. Services: integration tests on a REAL Postgres.
- No UI tests required. Frontend gate is `tsc` and `lint`.

## Real database rule

- `TEST_DATABASE_URL` points to a disposable Postgres (Docker, port 5433). NEVER the live database.
- Global setup: `prisma migrate deploy` (applies init AND the constraints migration). Before each test file:
  `TRUNCATE ... RESTART IDENTITY CASCADE` on all business tables, then re-ensure the settings row and reference data.
- Never mock Prisma. Mocks cannot prove locks, constraints or conditional updates.

## Time

- Domain functions take `now`. Services use `ClockService`; tests replace it with a fake clock set per test.
- `pnpm test:tz` runs the suite under `TZ=UTC` and `TZ=America/Los_Angeles`. Both must pass.

## Concurrency pattern

```ts
const results = await Promise.allSettled([action(), action()]);
// exactly one fulfilled, one rejected with the expected DomainError code and status 409
```

Required for: two edits with one `version`, start twice, done twice, last two units done in parallel (order must
become ready exactly once), two invoice creations over the same order, cut-off run twice in parallel.

## Test data

Build through real services or domain builders (`buildOrderInput`), never raw inserts, so totals stay reconcilable.

## Rules

- One behaviour per test, named by the rule: `it('rejects a locked order edit even before the cut-off job ran')`.
- No snapshot tests for business logic. No `any`. No skipped tests (`it.skip`) in a commit.
- Every bug fix adds a failing test first.

## Required index (details live in each skill's Tests section)

pricing (ten cases), time-and-cutoff (six cases + timezone matrix), orders (twelve cases incl. combination counting),
kitchen-dispatch (concurrency and chain), billing (invoicing), companies-employees, auth (guard, 404 ownership).
The four the PDF names explicitly: cut-off calculation, pricing resolution, combination counting, invoicing.
