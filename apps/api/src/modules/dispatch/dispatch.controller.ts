import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  assignDriverSchema,
  dispatchDropsQuerySchema,
  dropKeySchema,
} from '@repo/shared';
import type {
  AssignDriverInput,
  DispatchDropsQueryData,
  DropKeyInput,
} from '@repo/shared';
import { CurrentUser, RequirePermission } from '../auth/auth.decorator.js';
import type { RequestUser } from '../auth/auth.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { DispatchService } from './dispatch.service.js';

/**
 * Dispatch endpoints. PDF §4.8 / D-70.
 *
 * `dispatch.read` opens the board; `dispatch.manage` assigns the
 * driver and moves dispatch-ready / out-for-delivery per drop.
 */
@Controller('dispatch')
export class DispatchController {
  constructor(private readonly dispatch: DispatchService) {}

  @RequirePermission('dispatch.read')
  @Get('drops')
  listDrops(@Query(new ZodValidationPipe(dispatchDropsQuerySchema)) query: DispatchDropsQueryData) {
    return this.dispatch.listDrops(query.date);
  }

  @RequirePermission('dispatch.manage')
  @Post('drops/assign')
  assignDriver(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(assignDriverSchema)) body: AssignDriverInput,
  ) {
    return this.dispatch.assignDriver(
      {
        companyId: body.companyId,
        addressId: body.addressId,
        deliveryDate: body.deliveryDate,
        deliveryTimeMinute: body.deliveryTimeMinute,
      },
      body.driverId,
      user.id,
    );
  }

  @RequirePermission('dispatch.manage')
  @Post('drops/dispatch-ready')
  markDispatchReady(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(dropKeySchema)) body: DropKeyInput,
  ) {
    return this.dispatch.markDispatchReady(body, user.id);
  }

  @RequirePermission('dispatch.manage')
  @Post('drops/out-for-delivery')
  markOutForDelivery(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(dropKeySchema)) body: DropKeyInput,
  ) {
    return this.dispatch.markOutForDelivery(body, user.id);
  }
}
