---
name: catalogue-and-menu
description: Use for dishes, options, option groups, portions, reference lists, menu categories, hiding, secret categories, and the menu preview/availability rule.
---

# Catalogue and menu (PDF 4.1, 4.2)

## Catalogue rules

- Dishes, options, reference data are deactivated, never hard-deleted. Option groups belong to ONE dish
  and are edited or deleted (no history references them: orders snapshot).
- Groups are single-choice. Required group = exactly one option. Optional group = zero or one.
- `sku` and `costCents` are internal. They NEVER appear in employee-facing menu responses.
- Images are URLs in object storage. Never local disk (Render disk is ephemeral).
- Names of reference lists are unique case-insensitively (SQL index) and trimmed in the service.

## Portion invariant (PDF [Should]; build after all [Must])

Enforced in services, in a transaction, on every write that could break it:

- `usesPortions = true` -> the group has >= 1 `OptionGroupPortion`, AND every option in the group has an
  `OptionPortion` row for EVERY size the group sells.
- `usesPortions = false` -> the group has NO `OptionGroupPortion` rows.
  Re-check when: adding an option to a group, adding/removing a group size, toggling `usesPortions`,
  removing an option's size support.
  Deactivation: a station cannot be deactivated while an active dish uses it. A portion size cannot be
  deactivated while a group sells it. Allergens/tags deactivate by hiding from pickers only; links stay.

## Menu availability: ONE function, `MenuResolver.resolveForEmployee(employeeId)`

A dish is orderable by an employee ONLY IF ALL hold:

1. `Dish.isActive`.
2. The dish has >= 1 `MenuItem` where `MenuItem.isActive` AND its `MenuCategory.isActive` AND the item is not in
   the company's hidden items AND the category is not in the company's hidden categories.
3. The dish has a price > 0 on the employee's tier (skill: pricing).
4. Every required option group has >= 1 option that is active AND priced on that tier.
5. Portion groups satisfy the portion invariant for the options offered.
   Output: categories ordered by `sortOrder` then name, each with its visible items ordered the same way.
   Empty categories are omitted. A dish in several categories appears under each visible one.
   SECRET categories are excluded from the listing and returned only when requested by `slug`; they still obey
   every rule above. Orderability never depends on having "opened" a secret category (D-35).
   Employee view fields: name, description, image, temperature, allergens, dietary tags, minOrderQuantity,
   final price, option groups with option prices and portion extras. Nothing else.

## Used by

Preview endpoint (staff), order form, AND order validation at place time. No other code may decide
availability. The preview shows exactly the employee view (no extra debug panel, D-39 amended).

## Rules

- Reorder (categories, items) = one atomic bulk update. Hide endpoints replace the full set per company in one transaction.
- Hiding an item hides that placement only (D-34 amended).
- Categories and menu items may be hard-deleted (orders never reference them).
