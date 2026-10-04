---
name: frontend-standards
description: Use for ANY frontend work in apps/web. Token map from the real globals.css, typography, shadcn usage, forms, hooks, auth shell, status display, motion, and mobile driver rules.
---

# Frontend standards

## First, once

`apps/web/src/app/globals.css` is READ-ONLY. If a token or utility you need does not exist: STOP and ask. Never edit it,
never invent a token name, never hardcode a value. Before building UI, smoke-test that `text-card-title` changes the font
size (the file registers sizes as `--font-size-*`; Tailwind v4 documents `--text-*`). If it does not, STOP and report.

## Token map (exact names in globals.css)

- Surfaces: `bg-background`, `bg-background-panel`, `bg-background-elevated`, `bg-background-hover`, overlay `bg-background-overlay`.
- Text: `text-foreground-strong`, `text-foreground`, `text-foreground-muted`, `text-foreground-subtle`, `text-foreground-ghost`.
- Borders: `border-border`, `border-border-subtle`, `border-border-strong`. Inputs use `border-input`. Focus ring is global.
- Brand (`bg-brand`, `text-brand-foreground`, `bg-brand-muted`, `text-brand-muted-foreground`): use sparingly. Primary buttons are
  black via the shadcn bridge (`primary` = `foreground-strong`). Do not recolour shadcn components.
- Status: `bg-success`, `bg-warning`, `bg-destructive`, `bg-info`, `text-destructive`. NEVER `text-warning` (fails contrast).
- Radius `rounded-xs..4xl`, `rounded-pill`. Shadows `shadow-xs|sm|md|lg|card|card-hover|elevated`. Spacing: Tailwind default scale only.
- Z-index: shadcn defaults as-is. Custom layers only via `z-[var(--z-dropdown|sticky|overlay|modal|toast)]`.
- Never: hex/rgb/oklch literals, arbitrary values (`w-[13px]`, `text-[#fff]`), inline colour styles, `dark:` classes (light only).

## Typography (use ONLY these)

- Page and section titles, empty states, prose: `heading-xl|lg|md|sm`, `description-lg|base|sm` (they carry weight and colour).
- Dense UI: `text-card-title`, `text-subhead`, `text-body-lg`, `text-body`, `text-body-sm`, `text-caption`, `text-button`, `text-eyebrow`.
- Weights: `font-normal` body, `font-medium` labels and table headers, `font-semibold` titles. Nothing else.
- Numbers (money, counts, times, order numbers): add `tabular-nums`.
- One H1 per page. Hierarchy by size and colour token, not by extra bold.

## Components

shadcn components live in packages/ui/src/components/ui and are imported as @repo/ui/... : Sidebar, Table, Badge, Button, Input, Select, Dialog, Sheet, Tabs, Skeleton, Calendar/Popover, Form
primitives. Compose, never rebuild. Toasts only through the installed Base UI `toast` manager (`ui/toast.tsx`).
Status badge: one `StatusBadge` per status set (order, kitchen lateness, invoice) = small dot (`bg-success|warning|destructive|info`
or `bg-foreground-ghost`) + `text-caption text-foreground-muted` label. Always icon or label, never colour alone.
Kitchen late/at-risk: card left border (`border-l-2 border-destructive` late, `border-warning` at-risk) plus the word "Late" or "At risk".

## Layout (Linear-grade whitespace discipline)

Sidebar + content. Page header: `heading-sm`, optional `description-sm`, actions right-aligned. Content on `bg-background`,
panels on `bg-background-panel`, cards `rounded-lg shadow-card`. Consistent gaps from the Tailwind scale (4, 6, 8). Tables are dense
(`text-body-sm`), row hover `bg-background-hover`, server pagination, filters above. Empty, loading (Skeleton) and error states
exist for every list and form.

## Forms and errors

Every input: Zod schema from `packages/shared` -> inferred type -> `react-hook-form` + `zodResolver`. Never hand validation.
Form shape mirrors the API payload so server error `path` (for example `lines[0].combinations[1].choices`) maps 1:1 to a field
via one helper `applyServerErrors(form, errors)`. Unmapped errors show as a toast.

## Data and state

All fetching in `src/hooks/use-*.ts` (TanStack Query inside hooks only). One `lib/api-client.ts` parses `{ code, path, message }[]`.
Mutations invalidate by query key. No `useEffect` fetching. No Zustand without an approved plan. Functional components only.

## Auth shell

`/login` posts to `/api/auth/login`. The staff layout loads `/api/auth/me` on the server (forwarding the cookie), redirects to `/login`
on 401, then to the role's `landingPath`. Navigation items are filtered by permission keys from `packages/shared` (UX only; the
server enforces). Never use role names.

## Money and time display

`formatMoney(cents)` -> `$7.45`. Times and dates via shared helpers in the kitchen zone. Never `toLocaleString` without the zone.
Never compute "today", cut-off, price or totals in the browser except with shared helpers for previews.

## Motion

Only where the module plan names it. Presets live in `lib/motion.ts` (duration 0.15 to 0.25 s, ease `[0.16, 1, 0.3, 1]`).
Use `motion/react` and honour `useReducedMotion`.

## Driver screens

Mobile-first, one column, minimum touch height `h-11`, primary action sticky at the bottom, large readable address and time,
note field and optional photo on the delivery sheet.
