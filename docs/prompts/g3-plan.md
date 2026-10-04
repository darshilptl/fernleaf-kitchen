PLAN ONLY. Do not implement. Read the same sources as the Group 2 plan prompt, plus the skills time-and-cutoff and orders.
Write ONE docs/modules/group-3-time-and-orders/implementation.md for modules 6 (settings and kitchen calendar) and 7 (orders), backend and frontend. Cover:

- Settings page (kitchen working days, kitchen holidays, cut-off time and day count, atRiskMinutes); cutoffInstant and isLocked in packages/shared with the five worked checks and the timezone matrix (test:tz with cross-env).
- Orders: create flow screen (employee, delivery date, menu, line and combination builder, price breakdown, save draft, place), server validation in the skill's order, one pricing function, transitionOrder with version checks,
  state machine, list (filters date range, status, company, invoiced, search, pagination), detail (lines, choices, money breakdown, delivery details, timeline), admin overrides, reject, cancel.
- Cut-off processing: ScheduleModule job every minute, startup catch-up, manual trigger button, idempotent SQL with RETURNING, tests that run it twice and in parallel.
- The employee-move guard (D-29) now that orders exist; D-17 stays superseded by D-51.
- Concurrency tests on the real test database (two edits with one version; cut-off run twice).
  UI per AGENTS section 12, logging per section 13. The combination builder is the hardest screen: propose its design in the plan. End with files, manual check list, proposed D-entries. Stop and wait.
- Once this plan is written, stop implementation and run `docs/AUDIT.md` against the completed plan. The audit must be completed and all contradictions resolved, unsupported items labeled or removed, and proposed D-entries recorded as required by `docs/AUDIT.md`. Stop and wait for my approval of the audited plan. Do not implement anything before I explicitly approve it. Once I approve the audited plan, execute it strictly according to `docs/EXECUTE.md`. After execution is complete, I will manually test the implemented work and confirm that the plan has been fully implemented and everything is working correctly. Only after my confirmation, run `docs/COMMIT.md` and create the commit according to its instructions.
