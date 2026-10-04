import { DomainError, ceilToFiveCents } from '@repo/shared';

/**
 * Dish/option price resolution. PDF §4.3 / D-10..D-16.
 *
 * Single owner of resolution: typed price wins; otherwise the
 * tier rule derives (COST from cost, TIER recursively from the
 * source tier) with ceiling to five cents. Dish results must be
 * > 0 (computed 0 = no price, so the dish hides); option 0 is a
 * valid price (missing = unselectable). No fallback to the
 * default tier when the company tier lacks a price (D-13).
 * Recursion guarded by a visited set with depth cap 5 (D-16).
 */

export interface TierRule {
  derivationBasis: 'COST' | 'TIER' | null;
  sourceTierId: string | null;
  multiplierBp: number | null;
}

export interface PriceMaps {
  tiers: Map<string, TierRule>;
  dishPrices: Map<string, number>;
  optionPrices: Map<string, number>;
}

interface CostedItem {
  id: string;
  costCents: number;
}

function mapKey(tierId: string, itemId: string): string {
  return `${tierId}:${itemId}`;
}

/**
 * Resolve a dish price for an employee tier context.
 * Returns cents, or null when the dish has no price (hidden).
 */
export function resolveDishPrice(
  dish: CostedItem,
  tierId: string,
  maps: PriceMaps,
): number | null {
  const price = walk(tierId, dish, maps.dishPrices, maps, new Set<string>(), 0);
  if (price === null || price <= 0) {
    return null;
  }
  return price;
}

/**
 * Resolve an option price. Zero is a valid price; null means
 * unselectable on this tier.
 */
export function resolveOptionPrice(
  option: CostedItem,
  tierId: string,
  maps: PriceMaps,
): number | null {
  return walk(tierId, option, maps.optionPrices, maps, new Set<string>(), 0);
}

function walk(
  tierId: string,
  item: CostedItem,
  typed: Map<string, number>,
  maps: PriceMaps,
  visited: Set<string>,
  depth: number,
): number | null {
  if (visited.has(tierId) || depth > 5) {
    return null;
  }
  visited.add(tierId);
  const manual = typed.get(mapKey(tierId, item.id));
  if (manual !== undefined) {
    return manual;
  }
  const rule = maps.tiers.get(tierId);
  if (rule === undefined || rule.derivationBasis === null || rule.multiplierBp === null) {
    return null;
  }
  if (rule.derivationBasis === 'COST') {
    return ceilToFiveCents(item.costCents, rule.multiplierBp);
  }
  if (rule.sourceTierId === null) {
    return null;
  }
  const base = walk(rule.sourceTierId, item, typed, maps, visited, depth + 1);
  if (base === null) {
    return null;
  }
  return ceilToFiveCents(base, rule.multiplierBp);
}

/**
 * Validate a tier rule edit: reject self-source, cycles (walk the
 * chain), and depth beyond 5. Pure; takes the tier map as data.
 */
export function validateTierRule(
  tierId: string,
  rule: TierRule,
  tiers: Map<string, TierRule>,
): void {
  if (rule.derivationBasis === null) {
    return;
  }
  if (rule.derivationBasis === 'TIER') {
    if (rule.sourceTierId === null || rule.sourceTierId === tierId) {
      throw new DomainError({
        code: 'TIER_SELF_SOURCE',
        message: 'A tier cannot derive from itself',
        httpStatus: 409,
      });
    }
    let current: string | null = rule.sourceTierId;
    let depth = 0;
    const seen = new Set<string>([tierId]);
    while (current !== null) {
      if (seen.has(current)) {
        throw new DomainError({
          code: 'TIER_CYCLE',
          message: 'Tier derivation would create a cycle',
          httpStatus: 409,
        });
      }
      seen.add(current);
      depth += 1;
      if (depth > 5) {
        throw new DomainError({
          code: 'TIER_DEPTH',
          message: 'Tier derivation chain is deeper than 5',
          httpStatus: 409,
        });
      }
      const next = tiers.get(current);
      current = next?.derivationBasis === 'TIER' ? (next.sourceTierId ?? null) : null;
    }
  }
}
