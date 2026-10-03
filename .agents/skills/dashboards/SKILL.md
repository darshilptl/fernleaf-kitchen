---
name: dashboards
description: Use for the four role dashboards (PDF 4.11). Defines the definition-first process and a proposed starting set that must be approved in the module plan before any code.
---

# Dashboards (PDF 4.11)

The PDF grades honest, well-defined figures over impressive charts. The README must list, per dashboard:
what is shown and why, EXACTLY how each figure is calculated (which orders count, which date it groups by, how
cancelled orders and missing data are treated), and what was deliberately not shown.

## Process (mandatory)

1. The dashboards module plan (`docs/modules/dashboards/implementation.md`) contains a definition block for EVERY
   figure (template below). Wait for approval. No figure exists without a definition.
2. Definitions live in `docs/dashboards.md`. The README section is copied from it. Code comments cite figure IDs.
3. Figures are computed on the server with SQL aggregates through one `DashboardsService`. The browser only renders.

## Definition template

`ID | Role | Figure | Why this person needs it | Orders counted | Date basis | Cancelled/Rejected | Missing data | Formula`

## Global rules

- Date basis is `deliveryDate` in the kitchen zone. "Today" is `kitchenToday(now)`.
- Money is `totalCents`. Never floats. Display through `formatMoney`.
- Missing or not-applicable data shows "n/a", never 0. Zero is shown only when the true value is zero.
- Operational figures (kitchen, dispatch, driver) count CONFIRMED orders only (DELIVERED where the figure says so).
- Same status definitions as the rest of the system (billable = Confirmed or Delivered, uninvoiced).

## Proposed starting set (NOT approved, refine in the plan)

Admin: A1 orders by status, delivery dates today to today+6, all six statuses with zeros shown. A2 unbilled total and top
5 companies (billable and uninvoiced, sum of `totalCents`). A3 unpaid invoices: count, sum, age in days of the oldest
(`kitchenToday` minus creation date). A4 pricing gaps: count of active dishes with no effective price on the default tier.
Kitchen: K1 today's units: total, not started, in progress, done. K2 late and at-risk units (D-68) with order number and
planned kitchen-ready time. K3 open units by station, including "Unassigned". K4 next five planned kitchen-ready times.
Dispatch: P1 today's drops by stage (waiting for kitchen, kitchen ready, dispatch ready, out, delivered). P2 drops with no
driver. P3 drops past planned dispatch-ready and not out. P4 on-time deliveries today as delivered-on-time / delivered, "n/a" if none.
Driver: R1 my drops today in time order with stage, remaining count, next delivery time. Nothing else.
Not shown (state in README): revenue charts and margins (cost is not billed), tomorrow's prep forecast (cut-off processing may
still change it), per-worker output (not tracked), driver utilisation (availability not tracked).
