import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError } from '@repo/shared';
import type { BatchPricesInput, PriceTierInput, TierRuleInput } from '@repo/shared';
import { PrismaService } from '../../database/prisma.service.js';
import { logAction } from '../../common/logging/logging.interceptor.js';
import {
  resolveDishPrice,
  resolveOptionPrice,
  validateTierRule,
} from './domain/resolve-price.js';
import type { PriceMaps, TierRule } from './domain/resolve-price.js';

export type PriceSource = 'MANUAL' | 'DERIVED' | 'NONE';

export interface GridRow {
  id: string;
  name: string;
  kind: 'dish' | 'option';
  manualCents: number | null;
  effectiveCents: number | null;
  source: PriceSource;
}

export interface LoadedPriceMaps {
  tierId: string;
  maps: PriceMaps;
}

/**
 * Price tiers and typed prices. PDF §4.3.
 * Only typed prices are stored; derived prices compute on read
 * (D-10). Exactly one default tier; default swap is one
 * transaction. Price edits never touch past orders (snapshot).
 */
@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listTiers(): Promise<unknown[]> {
    return this.prisma.priceTier.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async createTier(input: PriceTierInput): Promise<{ id: string }> {
    const count = await this.prisma.priceTier.count();
    try {
      const tier = await this.prisma.priceTier.create({
        data: {
          name: input.name.trim(),
          isDefault: count === 0,
        },
        select: { id: true },
      });
      logAction(this.logger, 'pricing.create-tier', { tierId: tier.id });
      return tier;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError({
          code: 'VALIDATION_ERROR',
          message: 'Tier name is already used',
          httpStatus: 409,
        });
      }
      throw error;
    }
  }

  async updateTier(id: string, input: PriceTierInput): Promise<{ id: string }> {
    await this.requireTier(id);
    try {
      await this.prisma.priceTier.update({ where: { id }, data: { name: input.name.trim() } });
      logAction(this.logger, 'pricing.update-tier', { tierId: id });
      return { id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError({
          code: 'VALIDATION_ERROR',
          message: 'Tier name is already used',
          httpStatus: 409,
        });
      }
      throw error;
    }
  }

  async makeDefault(id: string): Promise<{ id: string }> {
    await this.requireTier(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.priceTier.updateMany({ data: { isDefault: false } });
      await tx.priceTier.update({ where: { id }, data: { isDefault: true } });
    });
    logAction(this.logger, 'pricing.make-default', { tierId: id });
    return { id };
  }

  async setTierActive(id: string, isActive: boolean): Promise<{ id: string }> {
    const tier = await this.requireTier(id);
    if (!isActive) {
      if (tier.isDefault) {
        throw new DomainError({
          code: 'TIER_DEFAULT_IMMUTABLE',
          message: 'The default tier cannot be deactivated',
          httpStatus: 409,
        });
      }
      const inUse = await this.prisma.company.findFirst({ where: { priceTierId: id } });
      if (inUse !== null) {
        throw new DomainError({
          code: 'TIER_IN_USE',
          message: 'Tier is used by a company',
          httpStatus: 409,
        });
      }
    }
    await this.prisma.priceTier.update({ where: { id }, data: { isActive } });
    logAction(this.logger, isActive ? 'pricing.activate-tier' : 'pricing.deactivate-tier', {
      tierId: id,
    });
    return { id };
  }

  async saveRule(id: string, input: TierRuleInput): Promise<{ id: string }> {
    await this.requireTier(id);
    const tiers = await this.prisma.priceTier.findMany({
      select: { id: true, derivationBasis: true, sourceTierId: true, multiplierBp: true },
    });
    const map = new Map<string, TierRule>(
      tiers.map((tier) => [
        tier.id,
        {
          derivationBasis: tier.derivationBasis,
          sourceTierId: tier.sourceTierId,
          multiplierBp: tier.multiplierBp,
        },
      ]),
    );
    const candidate: TierRule = {
      derivationBasis: input.derivationBasis,
      sourceTierId: input.sourceTierId,
      multiplierBp: input.multiplierBp,
    };
    if (candidate.derivationBasis === 'TIER' && candidate.sourceTierId !== null) {
      const source = await this.prisma.priceTier.findUnique({
        where: { id: candidate.sourceTierId },
        select: { id: true },
      });
      if (source === null) {
        throw new DomainError({
          code: 'TIER_NOT_FOUND',
          message: 'Source tier not found',
          httpStatus: 404,
        });
      }
    }
    validateTierRule(id, candidate, map);
    await this.prisma.priceTier.update({
      where: { id },
      data: {
        derivationBasis: candidate.derivationBasis,
        sourceTierId: candidate.sourceTierId,
        multiplierBp: candidate.multiplierBp,
      },
    });
    logAction(this.logger, 'pricing.save-rule', { tierId: id });
    return { id };
  }

  async getGrid(tierId: string, missingOnly: boolean): Promise<GridRow[]> {
    await this.requireTier(tierId);
    const { maps } = await this.loadPriceMaps(tierId);
    const [dishes, options] = await Promise.all([
      this.prisma.dish.findMany({
        where: { isActive: true },
        select: { id: true, name: true, costCents: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.option.findMany({
        where: { isActive: true },
        select: { id: true, name: true, costCents: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const rows: GridRow[] = [];
    for (const dish of dishes) {
      const manual = maps.dishPrices.get(`${tierId}:${dish.id}`) ?? null;
      const effective = resolveDishPrice(dish, tierId, maps);
      rows.push({
        id: dish.id,
        name: dish.name,
        kind: 'dish',
        manualCents: manual,
        effectiveCents: effective,
        source: manual !== null ? 'MANUAL' : effective !== null ? 'DERIVED' : 'NONE',
      });
    }
    for (const option of options) {
      const manual = maps.optionPrices.get(`${tierId}:${option.id}`) ?? null;
      const effective = resolveOptionPrice(option, tierId, maps);
      rows.push({
        id: option.id,
        name: option.name,
        kind: 'option',
        manualCents: manual,
        effectiveCents: effective,
        source: manual !== null ? 'MANUAL' : effective !== null ? 'DERIVED' : 'NONE',
      });
    }
    return missingOnly ? rows.filter((row) => row.source === 'NONE') : rows;
  }

  /**
   * Load the tier chain, typed prices, and the effective tier for
   * a company (company tier, else the default tier). Shared loader
   * for the grid and the menu resolver; the rule stays in the
   * pricing domain (single owner).
   */
  async loadPriceMaps(tierId: string): Promise<LoadedPriceMaps> {
    const tiers = await this.prisma.priceTier.findMany({
      select: { id: true, derivationBasis: true, sourceTierId: true, multiplierBp: true },
    });
    const rules = new Map(
      tiers.map((tier) => [
        tier.id,
        {
          derivationBasis: tier.derivationBasis,
          sourceTierId: tier.sourceTierId,
          multiplierBp: tier.multiplierBp,
        },
      ]),
    );
    // Typed prices for the whole derivation chain: the resolver
    // recurses into source tiers, so their typed rows must be
    // present (D-16 chains). Same depth cap as the resolver.
    const chain = [tierId];
    const seen = new Set(chain);
    for (let depth = 0; depth < 6; depth += 1) {
      const current = chain[chain.length - 1];
      if (current === undefined) {
        break;
      }
      const rule = rules.get(current);
      const source = rule?.derivationBasis === 'TIER' ? (rule.sourceTierId ?? null) : null;
      if (source === null || seen.has(source)) {
        break;
      }
      seen.add(source);
      chain.push(source);
    }
    const [dishPrices, optionPrices] = await Promise.all([
      this.prisma.dishTierPrice.findMany({ where: { tierId: { in: chain } } }),
      this.prisma.optionTierPrice.findMany({ where: { tierId: { in: chain } } }),
    ]);
    const maps: PriceMaps = {
      tiers: rules,
      dishPrices: new Map(dishPrices.map((row) => [`${row.tierId}:${row.dishId}`, row.priceCents])),
      optionPrices: new Map(
        optionPrices.map((row) => [`${row.tierId}:${row.optionId}`, row.priceCents]),
      ),
    };
    return { tierId, maps };
  }

  async resolveEmployeeTierId(companyTierId: string | null): Promise<string> {
    if (companyTierId !== null) {
      const tier = await this.prisma.priceTier.findUnique({
        where: { id: companyTierId },
        select: { id: true },
      });
      if (tier !== null) {
        return tier.id;
      }
    }
    const fallback = await this.prisma.priceTier.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });
    if (fallback === null) {
      throw new DomainError({
        code: 'TIER_NOT_FOUND',
        message: 'No default tier exists',
        httpStatus: 404,
      });
    }
    return fallback.id;
  }

  async saveBatchPrices(tierId: string, input: BatchPricesInput): Promise<{ ok: true }> {
    await this.requireTier(tierId);
    await this.prisma.$transaction(async (tx) => {
      for (const row of input.dishPrices) {
        const dish = await tx.dish.findUnique({ where: { id: row.itemId }, select: { id: true } });
        if (dish === null) {
          throw new DomainError({
            code: 'DISH_NOT_FOUND',
            message: `Dish not found: ${row.itemId}`,
            httpStatus: 404,
          });
        }
        await tx.dishTierPrice.upsert({
          where: { tierId_dishId: { tierId, dishId: row.itemId } },
          update: { priceCents: row.priceCents },
          create: { tierId, dishId: row.itemId, priceCents: row.priceCents },
        });
      }
      for (const row of input.optionPrices) {
        const option = await tx.option.findUnique({
          where: { id: row.itemId },
          select: { id: true },
        });
        if (option === null) {
          throw new DomainError({
            code: 'OPTION_NOT_FOUND',
            message: `Option not found: ${row.itemId}`,
            httpStatus: 404,
          });
        }
        await tx.optionTierPrice.upsert({
          where: { tierId_optionId: { tierId, optionId: row.itemId } },
          update: { priceCents: row.priceCents },
          create: { tierId, optionId: row.itemId, priceCents: row.priceCents },
        });
      }
    });
    logAction(this.logger, 'pricing.save-batch', {
      tierId,
      dishes: input.dishPrices.length,
      options: input.optionPrices.length,
    });
    return { ok: true };
  }

  async deleteTypedPrice(tierId: string, kind: string, itemId: string): Promise<{ ok: true }> {
    await this.requireTier(tierId);
    if (kind === 'dish') {
      await this.prisma.dishTierPrice.deleteMany({ where: { tierId, dishId: itemId } });
    } else if (kind === 'option') {
      await this.prisma.optionTierPrice.deleteMany({ where: { tierId, optionId: itemId } });
    } else {
      throw new DomainError({
        code: 'VALIDATION_ERROR',
        path: 'kind',
        message: 'Kind must be dish or option',
        httpStatus: 400,
      });
    }
    logAction(this.logger, 'pricing.clear-price', { tierId, itemId });
    return { ok: true };
  }

  private async requireTier(id: string): Promise<{ id: string; isDefault: boolean }> {
    const tier = await this.prisma.priceTier.findUnique({
      where: { id },
      select: { id: true, isDefault: true },
    });
    if (tier === null) {
      throw new DomainError({ code: 'TIER_NOT_FOUND', message: 'Tier not found', httpStatus: 404 });
    }
    return tier;
  }
}
