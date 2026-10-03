---
name: auth-permissions
description: Use for staff accounts, roles, permission keys, login, JWT cookie, guards, ownership checks, and the four test accounts.
---

# Auth and permissions (schema: Role, RolePermission, StaffUser)

## Permission keys (single list in `packages/shared/permissions`)

catalogue.read/manage, menu.read/manage, pricing.read/manage, companies.read/manage, employees.read/manage,
orders.read/create/override/cutoff_run, kitchen.read/work/force_complete, dispatch.read/manage,
deliveries.read_own/complete_own/assignable, billing.read/manage, settings.read/manage, staff.read/manage.

## Seeded roles (D-75: Admin excludes deliveries.assignable)

| Role                                                                                                                          | Keys                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Admin                                                                                                                         | ALL keys EXCEPT `deliveries.assignable` (so admins never appear in driver pickers) |
| Kitchen                                                                                                                       | orders.read, catalogue.read, kitchen.read, kitchen.work                            |
| Dispatch                                                                                                                      | orders.read, companies.read, kitchen.read, dispatch.read, dispatch.manage          |
| Driver                                                                                                                        | deliveries.read_own, deliveries.complete_own, deliveries.assignable                |
| `Role.landingPath`: Admin `/admin/dashboard`, Kitchen `/kitchen/dashboard`, Dispatch `/dispatch/dashboard`, Driver `/driver`. |
| On boot, re-sync the Admin role so a newly added key is granted automatically (still excluding assignable).                   |

## Accounts (exact, reviewers sign in with these)

admin@test.com, kitchen@test.com, dispatch@test.com, driver@test.com, password `Test@1234`, one role each.

## Algorithm: PermissionGuard

1. Read the JWT from the httpOnly cookie. Invalid/expired -> 401 `AUTH_REQUIRED`.
2. JWT holds ONLY the user id. Load user + role + permissions from the DB on EVERY request.
3. User missing or `isActive = false` -> 401. This makes deactivation and role changes immediate.
4. `@RequirePermission('x')`: key not in the role's permissions -> 403 `PERMISSION_DENIED`.
5. Attach `{ id, permissions }` to the request.

## Rules

- Code NEVER compares role names or keys (`role.key` is for seeding only). Ask "has permission X".
- Ownership lives INSIDE the query (`where: { driverId: user.id }`). Not found or not yours -> 404 (D-03).
- Cookie: httpOnly, secure in production, sameSite lax, 12h expiry, no refresh tokens. Browser reaches the API
  only through the Next.js `/api/*` rewrite so the cookie is first-party.
- Passwords: `bcryptjs`. Emails lowercased on write and lookup.
- A staff member cannot deactivate themselves. Deactivating a staff member clears `Company.defaultDriverId`
  references to them in the same transaction.
- Which staff appear in the driver picker: active users whose role holds `deliveries.assignable`.
- Staff management needs `staff.manage`. Exactly one role per user.
