# UI shell contract

Build every screen inside this shell. Regions, tokens, and patterns below are normative; see `AGENTS.md` §5 and the frontend-standards skill for the underlying rules.

## Files

- Shell: `apps/web/src/app/layout.tsx` → `PageGrid` (`components/layout/page-grid.tsx`) → `Navbar` (`components/Navbar.tsx`), `GridBoundary`, `{children}`, `GridBoundary`, `Footer` (`components/Footer.tsx`), plus `Toaster`.
- Dashboard: `apps/web/src/app/(staff)/layout.tsx` (guard) → `QueryProvider` (`providers/query-provider.tsx`) → `DashboardSidebar` (`components/layout/dashboard-sidebar.tsx`) → `SidebarInset` → page.
- Sources: nav `lib/nav.ts` (`NAV_GROUPS`); session `lib/session.ts` (`Session`), `lib/staff-session.ts` (`loadStaffSession`), `hooks/use-session.ts` (`useSession`, `SESSION_QUERY_KEY`); site links `lib/site.ts` (`GITHUB_URL`); API status `lib/api-health.ts` (`getApiHealth`).

## Regions

- Sidebar (dashboard only): user name/email header, grouped nav, logout footer, collapse rail. Sticky viewport height, icon-rail collapse on desktop, offcanvas Sheet on mobile via the stock shadcn primitive.
- Header: inset bar with `SidebarTrigger` + active-section label (`text-caption`). No page titles here.
- Content: `SidebarInset > main (p-4 md:p-6)` renders the route page. Pages own their H1 (`heading-sm`) + panel (`bg-background-panel rounded-lg shadow-card p-6`) + shadcn `Empty` states.
- Footer: public link columns, API status line, copyright bar. Rendered on every page including dashboards.
- Grid: full-height 1px rails at the `max-w-6xl` column edges; zero-height `GridBoundary` rows (full-bleed hairline + 2× 6px markers) below Navbar and above Footer.

## Slotting and routing

Routes are thin server pages under `app/(staff)/<role>/…`. The `(staff)` layout persists across `Link` clicks, so the sidebar never remounts; active state = exact match or child-prefix (`isNavActive`). Adding a page = one entry in `NAV_GROUPS` (+ route file). Nothing else changes. Public routes: `/`, `/login`, `/status`.

## Nav config shape

`NAV_GROUPS: [{ label, items: [{ label, href, permission: PermissionKey, icon: LucideIcon }] }]`; `visibleNavGroups(permissions)` filters. Permission-gating is UX only; the server enforces. Never role names.

## Page-header pattern

H1 `heading-sm` + `mb-6`; optional `description-sm`; actions right-aligned. One H1 per page. Dense text uses `text-body-sm`/`text-caption`; numbers add `tabular-nums`.

## Spacing and width

Content column `max-w-6xl`; gaps from the scale (4/6/8); panels `rounded-lg shadow-card`. No arbitrary values.

## Tokens and typography used by the shell

Surfaces `bg-background(-panel)`; text `text-foreground(-strong/-muted/-subtle)` — never the shadcn-contract `text-muted-foreground` in app code; borders `border-border` (+ global base border color); marker/rail accents via sidebar bridge tokens (`bg-sidebar*`, `text-sidebar-foreground`, `ring-sidebar-ring`); radius `rounded-lg` (`rounded-md` = 6px); `heading-sm`, `description-sm`, `text-body-sm`, `text-caption`; weights normal/medium/semibold only; no `tracking-*` outside token utilities; no durations without a token (omit transitions).

## Session

`loadStaffSession()` (React-`cache`d, cookies → `${API_URL}/api/auth/me`, `no-store`, null on non-OK, Zod-validated via shared `sessionSchema`) is the single server source, passed as `session` prop + `QueryProvider initialSession`. Client reads/mutations only via `useSession`; login/logout broadcast on `fernleaf:session` so tabs resync.
