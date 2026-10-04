import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service.js';
import { requireTestDatabaseUrl, truncateAll } from '../../../test/db.js';
import { CatalogueService } from '../catalogue/catalogue.service.js';
import {
  resolveDishPrice,
  resolveOptionPrice,
  validateTierRule,
} from './domain/resolve-price.js';
import type { PriceMaps, TierRule } from './domain/resolve-price.js';
import { PricingService } from './pricing.service.js';

/**
 * Pricing resolution and tier management. PDF §4.3.
 * Fixtures go through the real catalogue service so totals
 * stay reconcilable.
 */

const RULES = new Map<string, TierRule>();

function mapsFor(overrides?: {
  rules?: Map<string, TierRule>;
  dishPrices?: Map<string, number>;
  optionPrices?: Map<string, number>;
}): PriceMaps {
  return {
    tiers: overrides?.rules ?? RULES,
    dishPrices: overrides?.dishPrices ?? new Map<string, number>(),
    optionPrices: overrides?.optionPrices ?? new Map<string, number>(),
  };
}

describe('resolveDishPrice', () => {
  it('returns the typed price when one exists', () => {
    const maps = mapsFor({
      dishPrices: new Map([['tier:dish', 500]]),
    });
    expect(resolveDishPrice({ id: 'dish', costCents: 300 }, 'tier', maps)).toBe(500);
  });

  it('derives from cost with ceiling to five cents', () => {
    const rules = new Map<string, TierRule>([
      ['partner', { derivationBasis: 'COST', sourceTierId: null, multiplierBp: 24000 }],
    ]);
    expect(resolveDishPrice({ id: 'dish', costCents: 310 }, 'partner', mapsFor({ rules }))).toBe(
      745,
    );
  });

  it('derives from a source tier with percent uplift', () => {
    const rules = new Map<string, TierRule>([
      ['std', { derivationBasis: null, sourceTierId: null, multiplierBp: null }],
      ['ent', { derivationBasis: 'TIER', sourceTierId: 'std', multiplierBp: 11500 }],
    ]);
    const dishPrices = new Map([['std:dish', 184]]);
    const maps = mapsFor({ rules, dishPrices });
    expect(resolveDishPrice({ id: 'dish', costCents: 100 }, 'ent', maps)).toBe(215);
  });

  it('treats a computed zero as no price for dishes but valid for options', () => {
    const rules = new Map<string, TierRule>([
      ['zero', { derivationBasis: 'COST', sourceTierId: null, multiplierBp: 10000 }],
    ]);
    const maps = mapsFor({ rules });
    expect(resolveDishPrice({ id: 'dish', costCents: 0 }, 'zero', maps)).toBeNull();
    expect(resolveOptionPrice({ id: 'opt', costCents: 0 }, 'zero', maps)).toBe(0);
  });

  it('returns null with no typed price and no rule, and breaks cycles', () => {
    expect(resolveDishPrice({ id: 'dish', costCents: 300 }, 'tier', mapsFor())).toBeNull();
    const rules = new Map<string, TierRule>([
      ['a', { derivationBasis: 'TIER', sourceTierId: 'b', multiplierBp: 11000 }],
      ['b', { derivationBasis: 'TIER', sourceTierId: 'a', multiplierBp: 11000 }],
    ]);
    expect(resolveDishPrice({ id: 'dish', costCents: 300 }, 'a', mapsFor({ rules }))).toBeNull();
  });

  it('leaves exact multiples of five unchanged', () => {
    const rules = new Map<string, TierRule>([
      ['flat', { derivationBasis: 'COST', sourceTierId: null, multiplierBp: 10000 }],
    ]);
    expect(resolveDishPrice({ id: 'dish', costCents: 200 }, 'flat', mapsFor({ rules }))).toBe(200);
  });
});

describe('validateTierRule', () => {
  const tiers = new Map<string, TierRule>([
    ['std', { derivationBasis: null, sourceTierId: null, multiplierBp: null }],
    ['mid', { derivationBasis: 'TIER', sourceTierId: 'std', multiplierBp: 11000 }],
  ]);

  it('rejects self-source', () => {
    expect(() =>
      validateTierRule('std', { derivationBasis: 'TIER', sourceTierId: 'std', multiplierBp: 11000 }, tiers),
    ).toThrow(expect.objectContaining({ code: 'TIER_SELF_SOURCE' }));
  });

  it('rejects cycles', () => {
    expect(() =>
      validateTierRule(
        'std',
        { derivationBasis: 'TIER', sourceTierId: 'mid', multiplierBp: 11000 },
        tiers,
      ),
    ).toThrow(expect.objectContaining({ code: 'TIER_CYCLE' }));
  });

  it('accepts an empty rule and a valid chain', () => {
    expect(() =>
      validateTierRule('mid', { derivationBasis: null, sourceTierId: null, multiplierBp: null }, tiers),
    ).not.toThrow();
    expect(() =>
      validateTierRule(
        'mid',
        { derivationBasis: 'TIER', sourceTierId: 'std', multiplierBp: 11000 },
        tiers,
      ),
    ).not.toThrow();
  });
});

describe('PricingService', () => {
  const prisma = new PrismaService(requireTestDatabaseUrl());
  const pricing = new PricingService(prisma);
  const catalogue = new CatalogueService(prisma);

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedDish(sku: string, costCents: number): Promise<string> {
    const dish = await catalogue.createDish({
      name: `Dish ${sku}`,
      description: null,
      imageUrl: null,
      sku,
      temperature: 'HOT',
      costCents,
      stationId: null,
      minOrderQuantity: null,
      allergenIds: [],
      dietaryTagIds: [],
    });
    return dish.id;
  }

  it('resolves TIER-derived prices through the source tier typed rows', async () => {
    const standard = await pricing.createTier({ name: 'Standard' });
    const enterprise = await pricing.createTier({ name: 'Enterprise' });
    const dishId = await seedDish('CHAIN-1', 310);
    await pricing.saveBatchPrices(standard.id, {
      dishPrices: [{ itemId: dishId, priceCents: 700 }],
      optionPrices: [],
    });
    await pricing.saveRule(enterprise.id, {
      derivationBasis: 'TIER',
      sourceTierId: standard.id,
      multiplierBp: 11500,
    });
    const grid = await pricing.getGrid(enterprise.id, false);
    expect(grid.find((row) => row.id === dishId)).toMatchObject({
      source: 'DERIVED',
      effectiveCents: 805,
    });
  });

  it('makes the first tier the default and swaps it in one transaction', async () => {
    const first = await pricing.createTier({ name: 'Standard' });
    const second = await pricing.createTier({ name: 'Partner' });
    const tiers = (await pricing.listTiers()) as Array<{ id: string; isDefault: boolean }>;
    expect(tiers.find((tier) => tier.id === first.id)?.isDefault).toBe(true);
    await pricing.makeDefault(second.id);
    const after = (await pricing.listTiers()) as Array<{ id: string; isDefault: boolean }>;
    expect(after.filter((tier) => tier.isDefault)).toHaveLength(1);
    expect(after.find((tier) => tier.id === second.id)?.isDefault).toBe(true);
  });

  it('refuses to deactivate the default tier or a tier in use', async () => {
    const tier = await pricing.createTier({ name: 'Standard' });
    await expect(pricing.setTierActive(tier.id, false)).rejects.toMatchObject({
      code: 'TIER_DEFAULT_IMMUTABLE',
    });
    const other = await pricing.createTier({ name: 'Enterprise' });
    const packaging = await catalogue.createReference('packaging-types', { name: 'Box' });
    await prisma.company.create({
      data: {
        name: 'Acme',
        billingContactName: 'Ann',
        billingEmail: 'billing@acme.test',
        priceTierId: other.id,
        defaultDeliveryMinute: 720,
        defaultPackagingTypeId: packaging.id,
        domains: { create: [{ domain: 'acme.test' }] },
        addresses: {
          create: [
            {
              label: 'HQ',
              line1: '1 Main St',
              city: 'Mumbai',
              postalCode: '400001',
              country: 'IN',
              isDefault: true,
            },
          ],
        },
      },
    });
    await expect(pricing.setTierActive(other.id, false)).rejects.toMatchObject({
      code: 'TIER_IN_USE',
    });
  });

  it('reports grid sources and filters missing prices', async () => {
    const tier = await pricing.createTier({ name: 'Standard' });
    const dishId = await seedDish('GRID-1', 310);
    await pricing.saveBatchPrices(tier.id, {
      dishPrices: [{ itemId: dishId, priceCents: 500 }],
      optionPrices: [],
    });
    const grid = await pricing.getGrid(tier.id, false);
    expect(grid.find((row) => row.id === dishId)?.source).toBe('MANUAL');
    const missing = await pricing.getGrid(tier.id, true);
    expect(missing.every((row) => row.source === 'NONE')).toBe(true);
  });

  it('writes batch prices atomically and clears back to derived', async () => {
    const tier = await pricing.createTier({ name: 'Standard' });
    await pricing.saveRule(tier.id, {
      derivationBasis: 'COST',
      sourceTierId: null,
      multiplierBp: 24000,
    });
    const dishId = await seedDish('BATCH-1', 310);
    await pricing.saveBatchPrices(tier.id, {
      dishPrices: [{ itemId: dishId, priceCents: 500 }],
      optionPrices: [],
    });
    let grid = await pricing.getGrid(tier.id, false);
    expect(grid.find((row) => row.id === dishId)?.effectiveCents).toBe(500);
    await expect(
      pricing.saveBatchPrices(tier.id, {
        dishPrices: [{ itemId: '00000000-0000-0000-0000-000000000000', priceCents: 10 }],
        optionPrices: [],
      }),
    ).rejects.toMatchObject({ code: 'DISH_NOT_FOUND' });
    grid = await pricing.getGrid(tier.id, false);
    expect(grid.find((row) => row.id === dishId)?.effectiveCents).toBe(500);
    await pricing.deleteTypedPrice(tier.id, 'dish', dishId);
    grid = await pricing.getGrid(tier.id, false);
    expect(grid.find((row) => row.id === dishId)).toMatchObject({
      source: 'DERIVED',
      effectiveCents: 745,
    });
  });

  it('runs double default-swaps with exactly one default left', async () => {
    const first = await pricing.createTier({ name: 'Standard' });
    const second = await pricing.createTier({ name: 'Partner' });
    const results = await Promise.allSettled([
      pricing.makeDefault(first.id),
      pricing.makeDefault(second.id),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
    const tiers = (await pricing.listTiers()) as Array<{ isDefault: boolean }>;
    expect(tiers.filter((tier) => tier.isDefault)).toHaveLength(1);
  });
});
