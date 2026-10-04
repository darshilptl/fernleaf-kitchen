import { z } from 'zod';

/** Shared Zod schemas for pricing (PDF §4.3). Server pipe + RHF. */

export const priceTierSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export type PriceTierInput = z.input<typeof priceTierSchema>;

export const tierRuleSchema = z
  .object({
    derivationBasis: z.enum(['COST', 'TIER']).nullable(),
    sourceTierId: z.string().uuid().nullable(),
    multiplierBp: z.number().int().positive().nullable(),
  })
  .refine(
    (rule) =>
      (rule.derivationBasis === null &&
        rule.sourceTierId === null &&
        rule.multiplierBp === null) ||
      (rule.derivationBasis === 'COST' &&
        rule.sourceTierId === null &&
        rule.multiplierBp !== null) ||
      (rule.derivationBasis === 'TIER' &&
        rule.sourceTierId !== null &&
        rule.multiplierBp !== null),
    { message: 'Rule must be empty, COST with multiplier, or TIER with source and multiplier' },
  );

export type TierRuleInput = z.input<typeof tierRuleSchema>;

export const typedPriceSchema = z.object({
  itemId: z.string().uuid(),
  priceCents: z.number().int().min(0),
});

export const batchPricesSchema = z.object({
  dishPrices: z.array(typedPriceSchema).max(2000),
  optionPrices: z.array(typedPriceSchema).max(2000),
});

export type BatchPricesInput = z.input<typeof batchPricesSchema>;

export const priceGridQuerySchema = z.object({
  missingOnly: z.coerce.boolean().default(false),
});

export type PriceGridQuery = z.input<typeof priceGridQuerySchema>;
export type PriceGridQueryData = z.output<typeof priceGridQuerySchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.input<typeof paginationSchema>;
export type PaginationData = z.output<typeof paginationSchema>;
