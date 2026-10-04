import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import {
  batchPricesSchema,
  priceGridQuerySchema,
  priceTierSchema,
  tierRuleSchema,
} from '@repo/shared';
import type { BatchPricesInput, PriceTierInput, TierRuleInput } from '@repo/shared';
import { RequirePermission } from '../auth/auth.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PricingService } from './pricing.service.js';

/**
 * Pricing endpoints (tiers, rules, typed-price grid).
 * Reads need `pricing.read`; every write needs `pricing.manage`.
 */
@Controller('pricing/tiers')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @RequirePermission('pricing.read')
  @Get()
  listTiers() {
    return this.pricing.listTiers();
  }

  @RequirePermission('pricing.manage')
  @Post()
  createTier(@Body(new ZodValidationPipe(priceTierSchema)) body: PriceTierInput) {
    return this.pricing.createTier(body);
  }

  @RequirePermission('pricing.manage')
  @Patch(':id')
  updateTier(@Param('id') id: string, @Body(new ZodValidationPipe(priceTierSchema)) body: PriceTierInput) {
    return this.pricing.updateTier(id, body);
  }

  @RequirePermission('pricing.manage')
  @Post(':id/make-default')
  makeDefault(@Param('id') id: string) {
    return this.pricing.makeDefault(id);
  }

  @RequirePermission('pricing.manage')
  @Post(':id/deactivate')
  deactivateTier(@Param('id') id: string) {
    return this.pricing.setTierActive(id, false);
  }

  @RequirePermission('pricing.manage')
  @Post(':id/activate')
  activateTier(@Param('id') id: string) {
    return this.pricing.setTierActive(id, true);
  }

  @RequirePermission('pricing.manage')
  @Put(':id/rule')
  saveRule(@Param('id') id: string, @Body(new ZodValidationPipe(tierRuleSchema)) body: TierRuleInput) {
    return this.pricing.saveRule(id, body);
  }

  @RequirePermission('pricing.read')
  @Get(':id/grid')
  getGrid(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(priceGridQuerySchema)) query: { missingOnly: boolean },
  ) {
    return this.pricing.getGrid(id, query.missingOnly);
  }

  @RequirePermission('pricing.manage')
  @Put(':id/prices')
  saveBatchPrices(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(batchPricesSchema)) body: BatchPricesInput,
  ) {
    return this.pricing.saveBatchPrices(id, body);
  }

  @RequirePermission('pricing.manage')
  @Delete(':id/prices/:kind/:itemId')
  deleteTypedPrice(
    @Param('id') id: string,
    @Param('kind') kind: string,
    @Param('itemId') itemId: string,
  ) {
    return this.pricing.deleteTypedPrice(id, kind, itemId);
  }
}
