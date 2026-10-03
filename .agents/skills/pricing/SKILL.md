---
name: pricing
description: Use for price tiers, tier rules (cost x multiplier, another tier + percent), manual overrides, rounding up to 5 cents, price resolution, and the tier grid.
---

# Pricing (PDF 4.3)

## Data

- Only TYPED prices are stored (`DishTierPrice`, `OptionTierPrice`). Derived prices are computed on read (D-10).
- Tier rule: `derivationBasis` COST or TIER, `sourceTierId`, `multiplierBp` (10000 = x1.00,
  24000 = x2.4, 11500 = +15%).

## Integer math (packages/shared/money), NEVER floats

`ceilToFiveCents(baseCents, multiplierBp) = ceil(baseCents * multiplierBp / 50000) * 5`
Implement with integer division: `Math.floor((n + 49999) / 50000) * 5` where `n = baseCents * multiplierBp`.
Checks: cost 310 x 24000 -> 745. 184 x 11500 -> 215. A result already on a multiple of 5 is unchanged (D-11).
Typed prices are NOT rounded (D-12).
`parseMoney("7.45") -> 745` by string handling only. Multipliers: `"2.4"` -> 24000, `"+15%"` -> 11500, max 4 decimals.

## Algorithm: `resolveDishPrice(dish, tier, ctx)` (single owner)

1. tier for an employee = `employee.company.priceTierId ?? defaultTier.id`.
2. If a typed `DishTierPrice(tier, dish)` exists -> that price.
3. Else if the tier has a rule:
   - COST: `base = dish.costCents`.
   - TIER: `base = resolveDishPrice(dish, sourceTier)` (recursive). No price -> no price.
   - `price = ceilToFiveCents(base, multiplierBp)`.
4. Else no price.
5. Dish: result must be > 0. A computed 0 = no price (D-14). NO fallback to the default tier when the
   company's tier lacks a price (D-13).
   `resolveOptionPrice` is identical using `Option.costCents` and `OptionTierPrice`, EXCEPT 0 is a valid price
   (D-14). An option with no price is unselectable (D-15).
   Recursion guard: a visited set; depth cap 5.

## Tier management rules

- Exactly one default tier (partial unique index). Changing the default is one transaction. The default
  tier cannot be deactivated. A tier in use by any company cannot be deactivated.
- On saving a rule: reject self-source, reject cycles (walk the chain), cap depth 5.
- Tier grid `GET /pricing/tiers/:id/grid` returns every active dish and option with
  `{ manualCents, effectiveCents, source: MANUAL | DERIVED | NONE }`. Load dishes, typed rows and the tier
  chain in 3 queries and compute in memory. `PUT /pricing/tiers/:id/prices` applies a batch in ONE transaction.
- Portion extra charge is flat per size per group, not tiered (D-06).
- Price edits never touch past orders (orders snapshot).

## Tests (required)

310->745; 184->215; manual beats rule; company without tier uses default; company tier lacking a price hides the
dish (no fallback); chained tiers; cycle rejected; derived 0 -> no price for dish and valid for option; exact
multiples of 5 unchanged.
