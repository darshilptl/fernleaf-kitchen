---
name: companies-employees
description: Use for companies, email domains, addresses, company calendar, delivery defaults, employees, permission flags, owner rules, and CSV import.
---

# Companies and employees (PDF 4.4, 4.5)

## Company

- Create company + owner employee in ONE transaction (`POST /companies`). Owner must belong to the same
  company. An owner cannot be moved or deactivated until a new owner is set (D-18).
- Domains: trim, lowercase, strip a leading `@`, validate hostname shape, reject anything in
  `PUBLIC_EMAIL_DOMAINS` (packages/shared, starter list), globally unique (DB). Exact match only (D-19).
  > = 1 domain always. Employee email is NOT checked against domains (D-20 removed).
- Addresses: >= 1 active, exactly one active default (partial unique index). Changing default = one
  transaction. Never hard-deleted (orders reference them).
- Working days: ISO 1-7 array, >= 1 day, default Mon-Fri. Holidays: unique per date.
  `isCompanyDeliveryDay(company, date)` (packages/shared/calendar) = working day AND not a holiday.
  Used by the order form AND server validation. Calendar edits are NOT blocked by existing orders (D-27 removed).
- `defaultDeliveryMinute` 0-1439 (kitchen time zone). `dispatchLeadMinutes` 0-720 default 60.
- Default driver: active staff holding `deliveries.assignable`.
- Deactivated company: blocks new orders; existing orders continue to kitchen, dispatch, billing.
- Never hard-delete companies, employees, addresses.

## Employee

- Email lowercase, unique across all companies. Exactly one company.
- Flags default false: `canChooseAddress`, `canChangeDeliveryTime`, `canChangePackaging`.
  Meaning at order time: address may be any ACTIVE address of the company; otherwise the company default
  (D-23). Time and packaging likewise.
- Allergies and dietary preferences use the admin reference lists. Stored only. No warnings, no hiding (D-25 removed).
- Moving an employee to another company is BLOCKED while they have Draft or Placed orders (D-29).
  Confirmed/Delivered orders stay with their own `companyId`.
- Never hard-delete employees.

## CSV import ([Should], build LAST)

Columns: `name,email`. Flags default false. Validate every row first; insert all valid rows in ONE
transaction; return `{ imported, errors: [{ row, message }] }`. Existing email = row error (no update).
Max 1000 rows. Never reject the whole file for a row error.

## Tests

Domain uniqueness (case, `@`), public domains rejected, last domain/address protected, owner rules, single
default address, move blocked with open orders, CSV: 5 rows with 3 problems imports the 2 good ones.
