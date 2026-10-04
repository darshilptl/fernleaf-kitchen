PLAN ONLY. Do not implement.
Read AGENTS.md (all, including sections 11a to 15), docs/ui-shell.md, docs/DECISIONS.md, docs/assignment.txt, schema.prisma and the skills module-workflow, pricing, companies-employees,
catalogue-and-menu, ambiguity-log, testing, frontend-standards. Study the reference project "/home/darshil/Desktop/Vs Project/Development LAB/store" (read-only) for tables and for the
catalogue, menu and company/employee detail screens; in the plan list what you will reuse (after auditing it), what you will do better, and any new dependency (needs my approval).
Write ONE docs/modules/group-2-money-and-people/implementation.md for modules 3 (pricing), 4 (companies and employees), 5 (menu and preview), backend and frontend, with the module-workflow templates. Cover:

- Pricing: tiers CRUD, default swap in one transaction, rule editor (cost x multiplier, or other tier + percent), cycle check, typed-price grid per tier (dishes and options; MANUAL/DERIVED/NONE; "missing price" filter;
  batch save in one transaction), resolver (math in packages/shared, resolution in api domain), the ten pricing tests.
- Companies and employees: create company with owner in one transaction, unique domains with public blocklist, addresses with one default, calendar (working days, holidays), delivery defaults, tier link, default driver,
  employees table with create/edit/deactivate (flags, allergies, dietary), company detail with tabs. CSV import last as [Should]. The employee-move guard waits for Group 3 (no orders yet).
- Menu: categories (order, active, secret + slug), dish placements (a dish may sit in many categories), per-company hiding, ONE MenuResolver (six availability rules), preview as an employee (employee view only), tests.
  UI per AGENTS section 12 (DataTable, Sheet, AlertDialog, toast), logging per section 13. End the plan with: files list, the manual check list I will run, and proposed D-entries (from D-82).
  Stop and wait.
- Once this plan is written, stop implementation and run `docs/AUDIT.md` against the completed plan. The audit must be completed and all contradictions resolved, unsupported items labeled or removed, and proposed D-entries recorded as required by `docs/AUDIT.md`. Stop and wait for my approval of the audited plan. Do not implement anything before I explicitly approve it. Once I approve the audited plan, execute it strictly according to `docs/EXECUTE.md`. After execution is complete, I will manually test the implemented work and confirm that the plan has been fully implemented and everything is working correctly. Only after my confirmation, run `docs/COMMIT.md` and create the commit according to its instructions.
