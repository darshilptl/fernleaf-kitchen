# Dashboard UI audit + Linear-grade redesign (design/structure only). PLAN ONLY, do not implement.

Sources read: AGENTS.md (all, incl. §§11a–15), shadcn skill + rules (styling, forms,
composition, icons, base-vs-radix), frontend-standards SKILL.md, `docs/ui-shell.md`,
reference `Development LAB/store.craftlytech` (read-only study: tables, shell, cards,
type, buttons, dropdowns, overlays, forms, calendar, alerts).
Truths: `globals.css` is READ-ONLY (tokens verified below); no functionality changes —
every fix below is classes, composition, or same-behavior component swaps. New shadcn
primitives (calendar, popover, toggle-group) need explicit approval (AGENTS.md §1).
Base UI primitives (`@base-ui/react`), icon library `lucide-react`.

Out of scope (not audited, not touched): landing page, Footer, Navbar, Home,
dashed-grid (user-owned per AGENTS.md §11a); backend (zero changes); dashboard FIGURES
(G5 dashboards module owns them; stubs stay honest).

## 0. Verified baselines (no fix)

- Tokens exist: `rounded-pill` (`--radius-pill`), `bg-success/warning/destructive/info`
  (`--color-*`), `bg-background-panel`, `shadow-card`, `heading-sm`, `text-body/body-sm/
  caption`, `tabular-nums`, `z-[var(--z-*)]`. `status-badge.tsx` dot+text is correct.
- Tabs: all `TabsTrigger` inside `TabsList` (catalogue page, reference-tabs, company tabs).
- No `space-x/y`, no hex/arbitrary values, no `dark:`, no `z-index`, no sonner,
  no `animate-pulse`, no `<hr>` in dashboard src. Buttons use variant/size only.
  Toasts go through Base UI manager. `Empty`/`Skeleton` used (skeleton shape fixed in §2).
- `AlertDialog` correct in: category-list (Hide/Deactivate/Delete), order-detail
  (cancel), staff-table (deactivate). `Sheet+SheetTitle`, `Dialog+DialogTitle` present
  everywhere used. `settings-form` time input is NOT a calendar violation (keep).
- Attribute chips stay `Badge` (legitimate use): tier `Default`, address `Default`,
  group `Required/Optional`, category `Secret/Listed`.

## 1. Layout: REVERTED per user instruction (2026-10-05)

The fixed-shell items below were implemented, verified working in CDP
(main `overflow-y-auto`, sticky header), then REVERTED on user instruction:
the sidebar keeps its old exact grid placement between page-grid rails.
`dashboard-sidebar.tsx` and `docs/ui-shell.md` are back to HEAD state.
No layout fix ships in this pass.

## 1b. Table chrome to match the reference image (data-table.tsx, status-badge.tsx)

Reference shell: fixed-height card, `main flex-1 overflow-y-auto`, header fixed, sidebar
`fixed inset-y-0 h-svh` immune to content. Ours grows unbounded (window scrolls).

1. `dashboard-sidebar.tsx:48` — shell: `<SidebarProvider className="h-svh overflow-hidden">`
   (`overflow-hidden` on the SHELL only, forcing internal scroll; `h-svh` — no `h-full`
   chain exists since html/body set no height).
2. `dashboard-sidebar.tsx:104` — constrain column: `<SidebarInset className="h-svh min-h-0 overflow-hidden">`.
3. `dashboard-sidebar.tsx:105` — pin header: add `sticky top-0 z-10 bg-background`
   (keep `flex h-16 shrink-0 items-center gap-2 border-b`).
4. `dashboard-sidebar.tsx:115` — sole scroll container:
   `className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6"`.
5. `dashboard-sidebar.tsx:49` — remove dead `sticky top-0` (`Sidebar className="h-svh shrink-0"`).
   Base node is `fixed`; no behavior change.
6. `docs/ui-shell.md` — contract line update to the fixed shell (header sticky h-16 + main
   scroll). Docs-only, same change.

## 2. DataTable (components/data-table.tsx — inherited by every grid)

7. Sticky header: `<TableHeader className="sticky top-0 z-10 bg-background">` (+ bg on heads).
8. Skeleton as table rows (keep column widths): `Table > TableHeader + TableBody` with
   3× `<TableRow><TableCell colSpan={columns.length}><Skeleton className="h-5 w-full" /></TableCell></TableRow>`.
9. Hoist `{filters}` above the loading/error/empty early-returns (filters stay visible).
10. Pager: `aria-label="Previous page"/"Next page"` on buttons; `tabular-nums` on the
    `Page x of y` caption. (Clickable column sorting deferred — needs API sort keys,
    which is functionality; recorded, not built.)
11. Numeric cells: `tabular-nums` already passed by most callers; add where missing
    (price-grid typed-price Input: `className="tabular-nums text-right"`; dash gets
    `aria-label="No price"`).

## 3. Status display (dot+text StatusBadge; frontend-standards binding)

12. `staff-table.tsx:8,74`, `employees/employee-table.tsx:4,63`,
    `companies/company-table.tsx:5,47-48`, `catalogue/dish-table.tsx:4,42`,
    `catalogue/option-table.tsx:8,52` — Active/Inactive `Badge` →
    `StatusBadge tone="success"|"ghost"`, drop `Badge` import.
13. `pricing/price-grid.tsx:5,113-120` — Manual/Derived/None `Badge` →
    `StatusBadge info/success/ghost`. Move `missingOnly` checkbox into `filters` prop
    (L69-75,82). Replace fake pagination (L137-140 `onPageChange={() => undefined}`) with
    real server pagination from `useTierGrid`, or hide pager when `total <= pageSize`
    with a code comment (no fake controls).

## 4. Row actions (DropdownMenu exists in ui, zero uses in web)

14. `staff-table.tsx:76-93`, `employees/employee-table.tsx:65-78`,
    `catalogue/dish-table.tsx:44-57`, `catalogue/option-table.tsx:54-62` — inline action
    button rows → `DropdownMenu` + `DropdownMenuTrigger render={<Button variant="outline"
    size="sm">Actions</Button>}` (base API: `render`, not `asChild`) + `DropdownMenuContent`
    + `DropdownMenuGroup` + `DropdownMenuItem` per action. No behavior change.
15. `companies/company-table.tsx:50-60` single `Open` action — keep as row link (no
    dropdown for one action).

## 5. Selects (26 SelectContents; SelectGroup exists in ui/select)

16. Wrap every `SelectContent` list in `<SelectGroup><SelectLabel>…</SelectLabel>…`:
    staff-dialog ×2 (L92,140), menu-preview ×2 (L47,62), company-dialog ×3
    (L149,167,187), company-profile-tab ×4 (L138,160,180,204), order-builder ×4
    (L179,194,314,345), order-detail ×2 (L270,301), order-list ×3 (L150,169,188),
    rule-editor ×2 (L84,99), placement-manager ×1 (L92), dish-sheet ×3
    (L164,208,345).
17. Link labels: `rule-editor.tsx:72,93`, `dish-sheet.tsx:152,197,340` — add matching
    `id` on `SelectTrigger` + `htmlFor` on `FieldLabel`.
18. `company-dialog.tsx:75` — `DialogContent className="max-h-[85vh] overflow-y-auto"`
    contains an arbitrary value → `max-h-svh overflow-y-auto`. (Scrollable dialog
    content is correct; only the value changes.)
19. REJECTED (recorded, not built): dropping the `value ?? ''` null-guards in Select
    `onValueChange`. Base UI types `string | null` and `web check-types` FAILED without
    them earlier this week — evidence beats the rule doc. Guards stay.

## 6. Combination builder → ToggleGroup (needs `shadcn add toggle-group`)

20. `combination-builder.tsx:44-74` — Button loop with manual active state (+ `None`
    button) → base `ToggleGroup` (single; `defaultValue`/`value` are ARRAYS — wrap/unwrap:
    `value={[selected ?? 'none']} onValueChange={([v]) => …}`) + `ToggleGroupItem`
    per option incl. `None`. Check `toggle-group.tsx` from CLI for exact props after add.
21. `combination-builder.tsx:78-90` — raw `label`+Qty `Input` → `FieldGroup > Field >
    FieldLabel(htmlFor) + Input(id)`.

## 7. Checkbox groups → FieldSet + working-day legends

22. `settings/holiday-list.tsx:42-54`, `companies/company-calendar-tab.tsx:47-57` —
    raw `div+label+Checkbox` → `<FieldSet><FieldLegend>…working days</FieldLegend>
    <FieldGroup>…<Field orientation="horizontal"><Checkbox/><FieldLabel/>…`.
23. `catalogue/dish-sheet.tsx:264-267` raw Required checkbox → `Field`+`FieldLabel`.

## 8. Date inputs → shadcn Calendar (needs `shadcn add calendar popover`)

24. New shared `components/date-picker.tsx`: `Popover` + `PopoverTrigger
    render={<Button variant="outline">}` + `PopoverContent` + `Calendar mode="single"`,
    string `YYYY-MM-DD` value (parse/format via shared `time` helpers — pure string ops,
    no "today" computation), `aria-label`, error state passthrough. Base API per CLI docs.
25. Replace native date inputs, same behavior: `order-builder.tsx:205-210` (delivery date),
    `order-list.tsx:194-213` (From/To filters), `settings/holiday-list.tsx:83-88`,
    `companies/company-calendar-tab.tsx:82-87`. Forms using it switch bare `<form>` rows
    to `FieldGroup orientation="horizontal" > Field > FieldLabel` (holiday-list:72-98,
    company-calendar-tab:71-97).

## 9. AlertDialog scope (destructive-only)

26. `menu/placement-manager.tsx:115-137` — Hide is reversible (Show exists L75) →
    plain toggle `Button`; reserve `AlertDialog` for `Remove` (L80-82, currently
    unconfirmed) with consequence text. Add-row `div+Select` (L87-111) →
    `FieldGroup+Field+FieldLabel`.
27. `catalogue/dish-sheet.tsx:326` Delete group + `227-236` Deactivate dish (plain
    destructive Buttons) → `AlertDialog` with consequence text each.

## 10. Error text sizes (typography rule: every text needs a size utility)

28. Add `text-body-sm` to bare `text-destructive` (color stays): staff-dialog:158,
    option-table:137, dish-sheet:216, reference-tabs:153, csv-import-dialog:64,
    rule-editor:120, price-grid:81, tier-list:132, company-dialog:196,
    company-detail-tabs:22.

## 11. Explicitly NOT changing (studied, rejected with reason)

- Sheet-for-forms stays (AGENTS.md §12: create/edit in `Sheet`; reference uses Dialog,
  but our contract binds Sheet — no restyle of a binding pattern).
- No Card migration: panels already satisfy the binding skill
  (`bg-background-panel rounded-lg shadow-card`); reference Card spacing noted.
- No column sorting UI (needs API sort keys = functionality).
- Landing/Footer/Navbar/Home/dashed-grid untouched (user-owned, AGENTS.md §11a).
- No backend, schema, permission, or copy changes. No new deps beyond the two
  shadcn primitives pending approval.

## 12. Gate + manual checklist (user runs)

- `pnpm check-types && pnpm lint` (web), `pnpm --filter api test` untouched (no backend
  changes; full suite already green except the known seed LA-timeout flake).
- Visual pass per route (`/admin/*`, `/kitchen/dashboard`, `/dispatch/dashboard`,
  `/driver`, `/login`): header fixed + content scrolls at 1280/768/390px; sticky table
  heads; dropdown actions; date popovers; toggle groups; no console errors.

## 13. Self-audit (gaps hunted, then closed)

- Re-grepped all 60 tsx: every `SelectContent` inventoried (§5 = 26/26, incl.
  staff-dialog, menu-preview, company-dialog, profile-tab found on second sweep).
- Every `Badge` import dispositioned (§0 keep-list vs §3 convert-list; 12/12).
- Every `text-destructive` sized (§10; 10/10). Every `type="date"|"time"` dispositioned
  (§8 dates; settings time kept with reason). Every `type="number"` left native
  (no shadcn numeric component; not a calendar).
- Shell: `PageGrid`/`GridBoundary`/Navbar untouched with reason (public shell +
  user-owned header; dashboard subtree fix is self-contained). `docs/ui-shell.md`
  contract update included (§1.6).
- New-component risk: `calendar`, `popover`, `toggle-group` absent from ui — install
  step explicit, base-API notes included, no guessing.
- Contradictions: §5.19 (null-guards) resolved by build evidence; §11 Sheet retained
  by binding contract over reference habit; sorting deferred as functionality.
- Zero functionality changes: no endpoint, schema, permission, validation, copy, or
  route changes in any item above.
