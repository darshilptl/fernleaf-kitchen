# Dashboard definitions

PDF §4.11 / skill dashboards. Every figure: what, why, exact calculation.
Implemented figures ship in code (cited); defined-only figures wait for
their screen. The README section is copied from here.

Global rules: date basis is `deliveryDate` in `Asia/Kolkata`; "today" is
`kitchenToday(now)`; money is integer `totalCents` via `formatMoney`; missing
data shows "n/a", never 0; operational figures count CONFIRMED (DELIVERED
where stated); billable = Confirmed or Delivered, uninvoiced.

## Admin (`/admin/dashboard`, `DashboardsService.adminFigures`)

| ID | Figure | Why | Orders counted | Date basis | Cancelled/Rejected | Missing data | Formula | Status |
|----|--------|-----|----------------|------------|--------------------|--------------|---------|--------|
| A1 | Orders by status, today to today+6 | Week workload at a glance | All statuses in window | `deliveryDate` | Shown as their own slices | Zero shown as 0 (true zeros) | `COUNT(*)` + `SUM(totalCents)` per status, all six keys always present | Implemented |
| A2 | Unbilled total + top 5 companies | What can still be invoiced | CONFIRMED/DELIVERED, `invoiceId IS NULL` | All dates | Excluded (never billable) | 0 total + empty list when nothing billable | `SUM(totalCents)` overall + per company, top 5 by sum | Implemented |
| A3 | Unpaid invoices: count, sum, oldest age | Cash outstanding | n/a (invoices, `paidAt IS NULL`) | Age = `kitchenToday` − creation date (calendar days) | n/a | "n/a" age when none unpaid | `COUNT`, `SUM(totalCents)`, `MAX` age | Implemented |
| A4 | Pricing gaps: dishes with no default-tier price | Menu holes that hide dishes | n/a (dishes, active) | n/a | n/a | 0 when none | Count where `resolveDishPrice` is null on the default tier; none = no default tier | Implemented |

## Kitchen, dispatch, driver (G4 operational screens)

The landing pages for these roles ARE their dashboards: the kitchen board
(units by station with late/at-risk), the dispatch board (drops by stage),
the driver view (own drops today). Their figures below are defined here so
no figure exists without a definition; they render on those screens, not on
a separate dashboard page.

| ID | Figure | Why | Orders counted | Date basis | Status |
|----|--------|-----|----------------|------------|--------|
| K1 | Today's units: total, not started, in progress, done | 6am prep scope | CONFIRMED today units | `deliveryDate` = today | Defined (board shows units) |
| K2 | Late + at-risk units with order + planned time | What needs firefighting | Open units, D-68 | Live `now` vs planned | Defined (board marks lateness) |
| K3 | Open units by station incl. Unassigned | Station load split | Open units today | `deliveryDate` = today | Defined (board station filter) |
| K4 | Next five planned kitchen-ready times | What finishes next | Open units today | Planned instants | Defined |
| P1 | Today's drops by stage | Dispatch pipeline | CONFIRMED (+DELIVERED display) today | `deliveryDate` = today | Defined (board stages) |
| P2 | Drops with no driver | Assignment gaps | Drops with null driver | Today | Defined |
| P3 | Drops past planned dispatch-ready, not out | Late dispatch | Drops past planned, not out | Live `now` | Defined |
| P4 | On-time deliveries today (on-time / delivered) | Delivery quality | DELIVERED today; "n/a" if none | `deliveryDate` = today | Defined |
| R1 | My drops today in time order + remaining + next time | Driver's run | Own `driverId`, today | `deliveryTimeMinute` order | Defined (driver view) |

Not shown (deliberate): revenue charts and margins (cost is not billed),
tomorrow's prep forecast (cut-off may still change it), per-worker output
(not tracked), driver utilisation (availability not tracked).
