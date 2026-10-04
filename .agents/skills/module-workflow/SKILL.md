---
name: module-workflow
description: Use at the start of every module (backend or frontend). Defines build order, the Explore, Review, Plan, Wait, Execute, Gate, Close steps, and the implementation.md templates.
---

# Module workflow

## Order of modules (dependencies first)

0 scaffold + packages/shared + deploy the empty skeleton 1 auth, staff, roles 2 reference data + catalogue
3 pricing 4 companies + employees 5 menu 6 settings + time + cut-off 7 orders 8 kitchen 9 dispatch + driver
10 billing 11 seed 12 dashboards 13 README + final deploy check.
[Should] items last: portions, CSV import, delivery photo.
Deploy after module 1 and after every group of modules. A live link that works beats a perfect local build.

## Steps (never skip, never reorder)

1. Explore: read the PDF section, the matching skill, the schema models, DECISIONS, existing scaffold (frontend: tokens + `components.json`).
2. Review: list every constraint from the PDF, skills and decisions. Audit any reused code against AGENTS.md sections 1 to 5.
3. Plan: write `docs/modules/<module>/implementation.md` from the template below.
4. Wait: STOP. Do not write implementation code until the user explicitly approves the plan.
5. Execute: exactly the approved plan. No extras. A new need = stop and re-plan.
6. the gate is pnpm check-types && pnpm lint && pnpm test, plus pnpm --filter api prisma generate.
   Fix everything. Report the results. If anything is unclear: ask.
7. Close: append approved D-entries to `docs/DECISIONS.md`, commit in small Conventional Commits.

## Backend `implementation.md` template

```
# <module> (backend)
PDF sections: ...   Skills read: ...   Decisions touched: D-..
1. Flags from review (conflicts, risks)
2. Scope: [Must] items / [Should] items (each with PDF line)
3. Files (paths)
4. Domain functions (name, signature, numbered algorithm, invariants, edge cases)
5. Endpoints (method, path, permission key, request schema, response, error codes)
6. Transactions, locks and concurrency
7. Tests (named by rule)
8. New ambiguities with proposed D-entries (ID, PDF section, ambiguity, decision, why, alternative)
9. Gate checklist
```

## Frontend `implementation.md` template

```
# <module> (frontend)
PDF sections: ...   Skills read: ...   Decisions touched: D-..
1. Flags (old-code violations if reused, missing tokens)
2. Routes and layouts
3. Components (shadcn components used, new feature components)
4. Tokens used (exact names from globals.css, typography utilities per element)
5. Hooks (name, query key, endpoint) and Zod schemas (from packages/shared)
6. States: loading, empty, error, success; permission-hidden UI (UX only)
7. Motion (only if justified) and accessibility notes
8. New ambiguities with proposed D-entries
9. Gate checklist
```

## Approval batches (approved by the user)

One implementation.md and one approval per group. Steps 1 to 7 below run per group; Gate runs per module inside the group.

1. Foundation: modules 0, 1, 2 2. Money and people: 3, 4, 5 3. Time and orders: 6, 7
2. Floor: 8, 9, 10 5. Finish: 11, 12, 13
   A group plan covers every module in it. Any new need outside the approved plan = stop and re-plan.
