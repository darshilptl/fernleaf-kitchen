---
name: billing
description: Use for invoices, billable orders, marking paid, removing orders from invoices, and what happens to invoiced orders.
---

# Billing (PDF 4.9, D-53, D-74)

## Definitions

Billable order = `status IN (CONFIRMED, DELIVERED)` AND `invoiceId IS NULL`. Cancelled/Rejected are never billable.
`Order.invoiceId` is a single nullable column, so an order is on at most one invoice.
`Invoice.totalCents` is frozen at creation and ALWAYS equals the sum of its orders' `totalCents`.
Order totals cannot change after confirmation (lines are frozen, D-60).

## Create invoice (one transaction)

1. Input: `companyId`, `orderIds` (non-empty).
2. `SELECT id, "totalCents" FROM orders WHERE id = ANY($ids) AND "companyId" = $company AND "invoiceId" IS NULL AND status IN ('CONFIRMED','DELIVERED') FOR UPDATE`.
3. Row count != `orderIds.length` -> 409 `INVOICE_ORDERS_NOT_BILLABLE`.
4. `totalCents = sum(rows)`. Insert the invoice. `UPDATE orders SET "invoiceId" = $invoice WHERE id = ANY($ids)`.

## Mark paid (one-way)

`UPDATE invoices SET "paidAt" = $now, "paidById" = $user WHERE id = $id AND "paidAt" IS NULL`. 0 rows -> 409 `INVOICE_ALREADY_PAID`.

## Changing an invoiced order (D-74)

- Cancel or reject of an invoiced order is blocked: 409 `ORDER_INVOICED` (enforced in `transitionOrder` via `requireUninvoiced`).
- To change it: remove it from an UNPAID invoice first. Transaction: lock the invoice row; `paidAt` not null ->
  409 `INVOICE_PAID_IMMUTABLE`; `UPDATE orders SET "invoiceId" = NULL WHERE id = $order AND "invoiceId" = $invoice`
  (must affect 1 row); recompute `totalCents`; if no orders remain, delete the invoice.
- Paid invoices are immutable. Time/address/packaging overrides are allowed (no billing effect).
- A delivered order that turns out short is NOT modelled. It stays billed in full. Documented limitation (credit note = next step).

## Screens and queries

Per company: billable uninvoiced orders (select -> create invoice), invoices list with paid/unpaid and totals,
invoice detail with orders. Permissions: `billing.read`, `billing.manage`.

## Tests

Order can't be on two invoices (parallel creates); non-billable order rejected; invoice total == sum of orders;
remove-from-unpaid recalculates and deletes when empty; paid invoice immutable; cancel of invoiced order blocked;
mark paid twice -> 409.
