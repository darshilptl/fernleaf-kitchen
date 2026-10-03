---
name: seed-demo-data
description: Use for the seed script and any demo-data refresh. Defines required data, date-relative rules, idempotency, and what must never be seeded.
---

# Seed and demo data (PDF section 2: "Data")

Reviewers open the live app on an unknown day and judge by clicking. Empty screens hurt.

## Rules

1. EVERY date is computed from `kitchenToday(now)` plus an offset. Never a literal date.
2. Idempotent: running twice creates no duplicates. Use stable natural keys (emails, SKUs, names, slugs).
3. Demo records are tagged (a `demo` marker in a note field or a stable key prefix) so a refresh touches only demo
   data and NEVER deletes orders a reviewer created.
4. On server start, run `ensureDemoData()` (cheap): creates anything missing, including today's data.
   Admin-only "Regenerate demo data" action calls the same function.
5. Never seed Draft or Placed orders on a delivery date whose cut-off has passed (the job would process them
   within a minute). Draft/Placed only on dates with a future cut-off.
6. Today's kitchen/dispatch data: set `deliveryTimeMinute` relative to `now` (clamped to the same calendar day)
   so the board shows a mix: ON_TRACK, AT_RISK and at least one LATE unit.
7. Totals must reconcile: build seeded orders through the REAL order services/domain functions, not raw inserts.

## Required content

- Accounts: the four exact accounts (auth-permissions skill) with only their role's permissions.
- Reference data: allergens, dietary tags (incl. Vegan, Jain, Gluten-free), stations, portion sizes, packaging types.
- Catalogue and menu: a realistic menu (Bowls, Breakfast, Desserts, one secret category, one inactive category),
  options and groups (required and optional, one portion group).
- Pricing: 3 tiers (Standard default typed; Enterprise = Standard + 15%; Partner = cost x 2.4) with a few typed
  overrides and a few dishes deliberately MISSING a price on one tier.
- Companies: several, each with employees, addresses, calendar, delivery defaults; one on Enterprise, one on Partner,
  one with no tier; one with a holiday this week; one working Mon-Sat; one hiding a category and an item.
- Orders in EVERY status across past dates, today and the coming week: Delivered and Cancelled/Rejected in the
  past; Confirmed today (kitchen in all stages); Placed/Draft only on future-cut-off dates.
- Deliveries for `driver@test.com` today at several stages (assigned, dispatch-ready, out for delivery, delivered).
- Billing: confirmed uninvoiced orders, plus invoices some paid and some unpaid.
