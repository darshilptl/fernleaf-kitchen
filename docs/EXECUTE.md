EXECUTE docs/modules/<slug>/implementation.md exactly. Go module by module in the plan's order. After each module run pnpm check-types, pnpm lint and pnpm test and fix everything before the next module.
Follow AGENTS.md sections 12 and 13 for every screen and action. Do NOT commit. Any need not in the plan: STOP and report. When all modules pass, reply with: gate outputs, the files changed, deviations from the plan
(should be none), and the manual check list for me, each step with its expected result. Do not start another group.
