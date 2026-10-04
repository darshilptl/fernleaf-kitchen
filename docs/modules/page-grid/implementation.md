# Page grid + dashboard frame (frontend)

PDF sections: n/a — shell/UI task (product thinking, §9). Skills read: frontend-standards, module-workflow. Decisions touched: none yet; two proposed D-entries in §8.

Reference studied: `Projects/oravity` `components/layout/page-grid.tsx` (relative wrapper, centered `max-w-layout` container, absolute full-height rails, content above rails), `section-divider.tsx` (full-width divider strip), `app/layout.tsx` wiring (grid wraps Navbar + children + Footer), grid tokens (`--grid-dot-*`, `--grid-line-color`). Logic reused; Oravity's dotted visual is NOT reused.

Shared image studied (692px reference): 1px solid vertical rails at the content-column edges running top-to-bottom; 1px full-bleed horizontal hairlines at section boundaries; ~6px filled near-black squares centered exactly on each rail×hairline crossing.

## 1. Flags (audit against AGENTS.md §§1–5, skill constraints)

1. `globals.css` is READ-ONLY and has no layout/grid tokens (no max-width, no rail/marker tokens, no `z-content`). The plan uses only existing tokens + Tailwind default scale; no token is invented, no file edit proposed.
2. Content width: Oravity uses `--layout-max-width: 72rem`. Fernleaf has no equivalent token, but Tailwind's default `max-w-6xl` is also 72rem AND the existing `Navbar` inner container already uses `max-w-6xl` (`Navbar.tsx:35`). Rails at the grid container's edges therefore align exactly with the nav content edges. No new value introduced.
3. `Navbar` has its own `border-b border-border/60` (`Navbar.tsx:34`) and is the user's shell. Approved: the shell border is removed and `GridBoundary` owns the top line, so exactly one 1px hairline renders at the Navbar→content boundary.
4. `Footer.tsx` is Oravity leftover, not in scope to fix (user's shell): Oravity logo/links (`Footer.tsx:88`), utilities that do not exist in this theme and silently render nothing — `text-strong`, `text-subtle-foreground`, `pt-block`, `lg:gap-block` (`Footer.tsx:89,98,141,175,200`). Flagged only; grid wiring does not depend on footer internals.
5. `h-150` (Task 2 default) is not a historic Tailwind class, but Tailwind v4 generates spacing utilities dynamically from `--spacing`, so `h-150` = 37.5rem = 600px with no arbitrary value. Verified at gate time via computed-style check (§9); if it ever fails to generate, STOP and report.
6. No animation, no motion involved. No Playwright/vitest UI tooling installed — visual regression beyond the manual checklist (§9) would need a new dependency and is parked as a question, per AGENTS.md §1.1.
7. `app/layout.tsx`, user shell files, and dashboard page contents are wired, not redesigned.

## 2. Routes and layouts

- `app/layout.tsx` (edit, wiring only): wrap in `<PageGrid>` exactly like Oravity — `<PageGrid><Navbar /><GridBoundary placement="top" />{children}<GridBoundary placement="bottom" /><Footer /></PageGrid>`. No other layout change.
- `app/(staff)/layout.tsx` (edit, guard untouched): wrap `{children}` in `<DashboardFrame>` so every dashboard page inherits the frame with zero per-page setup. If a non-dashboard staff page ever needs no frame, it goes in a parallel route group — no exception logic in the layout.
- No new routes. Public pages (home, login) get grid + boundaries only, no frame.

## 3. Components (new feature components; no shadcn needed — structural divs only)

All in `apps/web/src/components/layout/` (new dir, kebab-case + role suffix per AGENTS.md §3):

- `page-grid.tsx` — `PageGrid({ children, className })`. Relative outer div with `overflow-x-clip` (contains the full-bleed hairline breakout); centered inner `relative mx-auto w-full max-w-6xl`; two rails `absolute inset-y-0 left-0 / right-0 w-px bg-border z-0 aria-hidden`; content `relative z-10`. Logic mirrors Oravity's `PageGrid`; dotted rails replaced with 1px solid token lines.
- `grid-boundary.tsx` — `GridBoundary({ placement }: { placement: 'top' | 'bottom' })`. Zero-height relative row (`relative h-0`) holding one full-bleed hairline + two markers:
  - Hairline: `absolute -top-px left-1/2 h-px w-screen -translate-x-1/2 bg-border aria-hidden`. At `top` it draws the line directly below the navbar (whose own `border-b` was removed per approval); at `bottom` (Footer has no top border) it draws the boundary line. One hairline per boundary either way.
  - Markers: `absolute top-0 size-1.5 -translate-x-1/2 -translate-y-1/2 bg-foreground-strong aria-hidden`, anchored `left-0` (left rail) and `right-0` + `translate-x-1/2` (right rail). 6×6 square, sharp corners (`rounded-none` is default), centered on the rail×hairline crossing.
  - Exactly 4 markers per GridBoundary (2 rails × top/bottom page boundaries). The dashboard frame's own border×rail crossings carry 4 more markers (approved: frame markers on). No other markers anywhere.
- `dashboard-frame.tsx` — `DashboardFrame({ children, heightClassName = DASHBOARD_FRAME_HEIGHT_CLASS })`. `section` with `border-y border-border bg-background relative` + height class; children rendered as-is (page contents keep their own padding/typography). Rails run behind it full-height (inherited automatically — the frame is in-flow content inside `PageGrid`).
  - `DASHBOARD_FRAME_HEIGHT_CLASS = 'h-150'` module const (SCREAMING_SNAKE per AGENTS.md §3) = single configuration point; override per render via the prop. No globals.css token (read-only).
  - `overflow-hidden` on the frame: fixed height is fixed — page content is designed to fit (per-page content is out of scope for this task). Documented risk, not silent: overflowing content clips instead of stretching the frame.

## 4. Tokens used (exact names from globals.css; typography n/a — no text rendered)

- Lines: `bg-border` (rails, hairlines) and `border-border` (frame `border-y`). Base layer already sets border-color globally; classes stay explicit per the skill's token map.
- Markers: `bg-foreground-strong` (near-black squares in both themes; decorative only, no contrast requirement).
- Surfaces: `bg-background` (grid container inherits body; frame section explicit).
- Scale (Tailwind defaults only, no arbitrary values): `max-w-6xl`, `w-px`/`h-px`, `size-1.5`, `h-150`, `-top-px`, `-translate-x-1/2`, `overflow-x-clip`, `z-0`/`z-10`, `relative`/`absolute`, `inset-y-0`, `left-0`/`right-0`, `w-screen`, `w-full`, `mx-auto`.
- No hex/rgb/oklch literals, no `w-[…]`, no inline styles, no `dark:` classes (light only; tokens adapt automatically).

## 5. Hooks and Zod schemas

None. All three components are presentational: no props beyond `children`/`className`/placement/height, no data fetching, no validation, no state. No `useEffect`, no TanStack Query (skill §5.9: hooks only where fetching exists).

## 6. States

No loading/empty/error/success states (static layout chrome). Decorative nodes carry `aria-hidden`. Permission-hidden UI: n/a. Failure mode is visual only: if a token class ever stops generating, lines/markers vanish silently — covered by the §9 visual checklist, not by runtime code.

## 7. Motion and accessibility notes

- Motion: none (static 1px geometry; nothing to animate, no `lib/motion.ts` entry).
- a11y: rails, hairlines, markers are `aria-hidden` divs (no semantics, no focus, no color-alone information — they duplicate section structure already exposed by `header`/`main`/`footer` landmarks). Frame `section` without label: intentional, it is a visual container, not a landmark. `overflow-x-clip` must not trap keyboard or obscure focused content (§9 checks 375px viewport). Reduced-motion: n/a.

## 8. New ambiguities with proposed D-entries + approval questions

Proposed at plan time; NOT appended (explicit instruction at approval).

| ID | Area | Ambiguity | Decision | Why | Alternative |
|----|------|-----------|----------|-----|-------------|
| D-80 | Shell grid | Marker/line geometry source | Rails/hairlines 1px, markers 6px squares, `max-w-6xl` column, token colors only | Least inventive reading of the shared image with zero new tokens | New globals.css tokens |
| D-81 | Dashboard frame | Fixed-height configurability without tokens | `DASHBOARD_FRAME_HEIGHT_CLASS` const, default `h-150`, prop override; `overflow-hidden` | globals.css is read-only; single variable satisfies the spec | Theme token (needs file edit approval) |

Resolved at approval (no D-entries added, per instruction):

1. Frame crossings: markers ON (implemented in `DashboardFrame`).
2. Top boundary: `Navbar` `border-b` removed; `GridBoundary` owns the line.
3. Visual regression: manual check by the user; no Playwright.

## 9. Gate checklist

- `pnpm --filter web check-types` clean; `pnpm --filter web lint` (max-warnings 0) clean; full `pnpm check-types && pnpm lint && pnpm test` + `next build` clean (layout work must not break the staff-guard build).
- Visual checklist (DevTools, light theme): rails exactly 1px wide, full page height, at `max-w-6xl` edges; markers exactly 6×6 centered on crossings; hairlines span full viewport width; frame computed height exactly 600px; no horizontal scrollbar at 1280 / 1440 / 1920 / 375px; sticky navbar scrolls over (not under) rails; `?next=` login flow and `(staff)` redirects unaffected.
- Confirm no `globals.css` diff, no new dependency, no per-page edits.
