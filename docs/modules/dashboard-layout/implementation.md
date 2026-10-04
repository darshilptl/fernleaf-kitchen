# Shared dashboard layout (frontend)

PDF sections: 3 (role dashboards land here; figures per dashboards skill — content out of scope), 4.11 (dashboard definitions live in README, not this task). Skills read: frontend-standards, module-workflow, dashboards (layout only — no figure needs a definition to place chrome). Decisions touched: none yet; D-82, D-83 proposed in §8.
Source of truth: `docs/assignment.txt` canonical; DECISIONS.md overrides skill prose.

Reference studied: `Development LAB/store.craftlytech` — two near-duplicate sidebars (`admin-sidebar.tsx` 170 lines, `profile-sidebar.tsx` 280 lines) + two layouts doing identical auth→session→sidebar-wrap. Duplication is exactly what this task eliminates: ONE sidebar, ONE layout. Reused: shadcn sidebar primitives (`SidebarProvider`, `Sidebar collapsible="icon"`, `SidebarTrigger`, `SidebarRail`, `SidebarInset`, groups/menu/buttons), `usePathname` active state, `Link`-based routing inside a persistent layout. NOT reused: per-role sidebar copies, card-wrapper layout (`rounded-xl ring-1 h-[calc(100vh-6rem)]` — arbitrary values, banned), custom motion logout dialog (shadcn `Dialog` covers it; current simple logout needs no dialog at all), hardcoded colors (`text-red-500`, `bg-black/60`), `dark:` classes, `useEffect` store hydration with eslint-disable, sonner/localStorage/`window.location` logout.

## 1. Flags (review constraints + conflicts)

1. `globals.css` is READ-ONLY. The shadcn sidebar needs `bg-sidebar`, `text-sidebar-foreground`, `bg-sidebar-accent`, `text-sidebar-accent-foreground`, `bg-sidebar-border`, `ring-sidebar-ring` — ALL exist as registered bridge tokens (`--color-sidebar*`, globals.css:345-352). Widths are inline CSS vars in the component, not tokens. No token work needed; if the CLI emits anything else missing, STOP and report.
2. `dashboard-frame.tsx` (page-grid task) is imported but never rendered in `(staff)/layout.tsx:2-4` — dead code under AGENTS.md §1.6. It also conflicts with this task ("no custom frame", fixed `h-150` + `overflow-hidden` would clip sidebar content). Resolution: delete the file, remove the import. Grid rails + `GridBoundary` markers stay untouched.
3. `lib/nav.ts` `NAV_ITEMS` is flat and permission-keyed — keep it as the single source; this plan extends it to groups + icons, never role names. Routes it points to that do not exist yet (`/admin/catalogue`, `/admin/orders`, `/admin/billing`, `/admin/staff`) stay unbuilt: the sidebar renders only permission-passing items, and missing pages 404 naturally until their modules land. No placeholder routes invented.
4. shadcn additions ONLY via the `shadcn` CLI (Group 1 rule): `sidebar`, `avatar` if needed (plan: not needed — text-only header), `table` NOT this task (layout chrome only; first table module brings the `table` component plus a `@tanstack/react-table` approval question — new dependency, AGENTS.md §1.1). CLI auto-deps (`sheet`, `tooltip`, `use-mobile` hook, radix packages) land in `apps/web` as usual.
5. Sidebar content height: the primitive's container is `h-svh`; between Navbar and Footer that overflows. Plan overrides with `sticky top-0 h-svh` via the component's `className` merge (tailwind-merge keeps the override) — standard docs pattern, default utilities only, no arbitrary values.
6. No `useEffect` fetching, no store (reference's Zustand hydration has no equivalent need — session comes from the server layout prop + existing `use-session` for logout), no motion, no custom dialog.
7. Dashboard page H1s stay one-per-page inside page content; the inset header carries only trigger + active-section label (`text-caption`), never a second H1.

## 2. Routes and layouts

- `app/(staff)/layout.tsx` (edit; server guard untouched): after the `loadStaffSession` null-check, render `<QueryProvider><DashboardSidebar session={session}>{children}</DashboardSidebar></QueryProvider>`. Guard logic byte-identical; per-page `landingPath` redirects stay in pages.
- No new routes, no route groups, no per-page setup. Every current and future `(staff)` page inherits sidebar + inset automatically. A page needing no sidebar later goes in a parallel group — no exception flags in this layout.
- Public routes (`/`, `/login`) unaffected (outside `(staff)`).

## 3. Components (shadcn first; one new feature component)

- `components/layout/dashboard-sidebar.tsx` (`'use client'`, functional only): `SidebarProvider` > `Sidebar collapsible="icon" className="sticky top-0 h-svh"` (Header: name + email from session prop, `text-body-sm`/`text-caption text-foreground-muted`; Content: grouped nav; Footer: logout menu item via existing `useSession().logout`; `SidebarRail`) + `SidebarInset` (header row: `SidebarTrigger` + active group/item label; `main` renders `{children}` with page-owned padding). Desktop: trigger collapses to icon rail; mobile (<md): shadcn renders the sidebar as a `Sheet` offcanvas, same trigger opens it — exact out-of-the-box behavior, zero custom responsive code.
- shadcn via CLI: `sidebar` (+ auto: `sheet`, `tooltip`, `use-mobile`, radix deps). `separator`, `skeleton`, `button` already in `@repo/ui`. No `avatar` (text-only header), no `table`, no `dialog` in this task.
- Deleted: `components/layout/dashboard-frame.tsx` + its import. Kept: `PageGrid`, `GridBoundary`, `LogoutButton` (reused inside the sidebar footer; removed from the four placeholder pages along with their header rows — pages keep H1 + `Empty` body).
- Active state: `usePathname()` exact match plus child-route prefix (`pathname === href || pathname.startsWith(href + '/')`), one helper `isNavActive` in the sidebar file. Never role names.

## 4. Tokens used (exact names; typography utilities per element)

- Sidebar surfaces/text: `bg-sidebar`, `text-sidebar-foreground`, `text-sidebar-foreground/70` (group labels), `bg-sidebar-accent` / `text-sidebar-accent-foreground` (active/hover via primitive), `bg-sidebar-border` (separators), `ring-sidebar-ring` (focus, global ring behavior preserved).
- Header label: `text-caption text-foreground-muted`; user name `text-body-sm font-medium`; email `text-caption text-foreground-muted`.
- Layout: default scale only — `sticky top-0 h-svh`, `flex`, `gap-2`, `p-2`/`p-4`/`px-4`, `h-16` inset header (craftlytech-proven; default scale), `size-7` trigger is inside the primitive.
- No hex/rgb/oklch, no arbitrary values, no inline color styles, no `dark:` classes. Numbers n/a (no figures in chrome).

## 5. Hooks and Zod schemas

- Nav config: extend `lib/nav.ts` — `NAV_GROUPS: readonly [{ label: string; items: readonly [{ label, href, permission: PermissionKey, icon: LucideIcon }] }]` (type-only lucide import; file stays pure data), keep `visibleNavItems` + add `visibleNavGroups(permissions)` filter. Adding a dashboard page = one entry; zero structural change.
- Data: session passed as server prop (`{ id, name, email, permissions, landingPath }` — existing `Session` type); logout via existing `use-session`. No new hooks, no new query keys, no Zod (no inputs in chrome).

## 6. States: loading, empty, error, success; permission-hidden UI

- Sidebar renders synchronously from the server-provided session — no skeleton needed (guard already resolved). `use-session` refresh keeps permissions fresh; a revoked permission hides the item on next render (UX only; `PermissionGuard` enforces).
- Empty group after filtering renders nothing (no empty-state chrome for nav). Error/loading/success: n/a to chrome; page contents own theirs per module plans.

## 7. Motion and accessibility notes

- Motion: the primitive's own `transition-[width]`/`ease-linear` only; no plan-named motion, no `lib/motion.ts` entry.
- a11y: `SidebarTrigger` has built-in `sr-only` "Toggle Sidebar" + `PanelLeftIcon` (decorative); mobile `Sheet` brings focus trap + `SheetTitle` semantics free; `aria-label` on rail; nav is a real list of links (keyboard-native); active item also bolded text, never color-alone; `useIsMobile` is matchMedia-based (no resize listeners to leak). Reduced-motion: width transition is transform/width-based paint — acceptable; no custom animation to gate.

## 8. New ambiguities with proposed D-entries

| ID | Area | Ambiguity | Decision | Why | Alternative |
|----|------|-----------|----------|-----|-------------|
| D-82 | Dashboards | One sidebar per role (reference pattern) vs one shared | ONE permission-filtered sidebar for all roles; groups from a single config | Reference duplication is the documented failure mode; permissions already drive nav | Per-role sidebars |
| D-83 | Dashboards | Fixed dashboard frame vs sidebar layout | Delete `dashboard-frame.tsx`; sidebar layout sits directly in the page grid | Fixed `h-150` + `overflow-hidden` clips sidebar content; user overrode with "no custom frame" | Keep frame around sidebar |

## 9. Gate checklist

- `pnpm --filter web check-types` + `lint` (max-warnings 0) clean; full `pnpm check-types && pnpm lint && pnpm test` + `pnpm --filter api prisma generate` + `next build` clean; `git status` shows no `globals.css` diff and no non-CLI `ui/` file.
- Manual checklist (user verifies visually): desktop sidebar visible, trigger collapses to icon rail with tooltips; 375px viewport shows trigger only, opens offcanvas Sheet, closes on link click; each of the 4 accounts sees only its links (admin 4 incl. Staff when built, kitchen/ dispatch/dispatch, driver 1) with correct active highlight incl. nested paths; no horizontal scrollbar at 1280/1440/1920/375; sticky sidebar slides under the sticky Navbar (z-50 > sidebar z-10); footer reachable below content; login/logout/`?next=` flows unchanged.
