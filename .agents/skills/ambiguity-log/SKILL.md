---
name: ambiguity-log
description: Use whenever the PDF is silent or ambiguous, when two readings are possible, or when tempted to add anything beyond the PDF. Defines how to log decisions in docs/DECISIONS.md.
---

# Ambiguity log

## When

- The PDF doesn't say, or can be read two ways.
- You want to add a column, endpoint, library, feature or screen the PDF does not ask for.

## Procedure

1. STOP coding that part.
2. Pick the LEAST INVENTIVE reading consistent with the PDF. Prefer literal over clever.
3. Append to `docs/DECISIONS.md` BEFORE writing code:
   `| D-<next number> | PDF section | Ambiguity | Decision | Why | Alternative |`
4. If it is an ADDITION beyond the PDF, label it "Beyond the PDF", leave it unbuilt, and wait for approval.
5. Put the proposed entry in the module plan (`implementation.md`) so the user sees it before execution.
6. Never reopen an approved decision (D-01 to D-75). If one blocks you, flag it and wait.

## Never

- Silent assumptions, "obvious" additions, or hidden defaults.
- Editing an old entry. Supersede it with a new entry that names the old ID.
