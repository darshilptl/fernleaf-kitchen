import { Body, Controller, Get, Post } from '@nestjs/common';
import { dropKeySchema, markDeliveredSchema } from '@repo/shared';
import type { DropKeyInput, MarkDeliveredInput } from '@repo/shared';
import { CurrentUser, RequirePermission } from '../auth/auth.decorator.js';
import type { RequestUser } from '../auth/auth.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { DispatchService } from './dispatch.service.js';

/**
 * Driver endpoints. PDF §4.8 / D-70.
 *
 * A driver sees only their own drops for today, in time order, at
 * any stage; "delivered" is enabled only when out-for-delivery and
 * enforced server-side. Ownership sits inside the query (D-03).
 */
@Controller('deliveries')
export class DriverController {
  constructor(private readonly dispatch: DispatchService) {}

  @RequirePermission('deliveries.read_own')
  @Get('today')
  listToday(@CurrentUser() user: RequestUser) {
    return this.dispatch.listOwnDrops(user.id);
  }

  @RequirePermission('deliveries.complete_own')
  @Post('drops/delivered')
  markDelivered(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(markDeliveredSchema)) body: MarkDeliveredInput,
  ) {
    const key: DropKeyInput = dropKeySchema.parse({
      companyId: body.companyId,
      addressId: body.addressId,
      deliveryDate: body.deliveryDate,
      deliveryTimeMinute: body.deliveryTimeMinute,
    });
    return this.dispatch.markDelivered(key, user.id, body.note, body.photoUrl);
  }
}
