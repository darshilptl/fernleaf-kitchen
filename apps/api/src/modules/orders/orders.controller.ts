import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createOrderSchema,
  orderListQuerySchema,
  overrideDetailsSchema,
  rejectOrderSchema,
  updateOrderSchema,
  versionSchema,
} from '@repo/shared';
import type {
  CreateOrderInput,
  OrderListQueryData,
  OrderVersionInput,
  OverrideDetailsInput,
  RejectOrderInput,
  UpdateOrderInput,
} from '@repo/shared';
import { CurrentUser, RequirePermission } from '../auth/auth.decorator.js';
import type { RequestUser } from '../auth/auth.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { OrdersService } from './orders.service.js';

/**
 * Order endpoints. PDF §4.6 / D-65.
 *
 * `orders.read` lists and shows; `orders.create` creates, edits,
 * places and cancels while unlocked; `orders.override` rejects,
 * overrides details and cancels past the cut-off (the cancel route
 * takes `orders.create` and lets override holders through locked
 * dates); `orders.cutoff_run` triggers processing manually.
 */
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @RequirePermission('orders.create')
  @Post()
  createOrder(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createOrderSchema)) body: CreateOrderInput,
  ) {
    return this.orders.createOrder(user.id, body);
  }

  @RequirePermission('orders.create')
  @Patch(':id')
  updateOrder(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateOrderSchema)) body: UpdateOrderInput,
  ) {
    return this.orders.updateOrder(user.id, id, body);
  }

  @RequirePermission('orders.create')
  @Post(':id/place')
  placeOrder(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(versionSchema)) body: OrderVersionInput,
  ) {
    return this.orders.placeOrder(user.id, id, body.version);
  }

  @RequirePermission('orders.create')
  @Post(':id/cancel')
  cancelOrder(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(versionSchema)) body: OrderVersionInput,
  ) {
    return this.orders.cancelOrder(user.id, id, body.version, hasOverride(user));
  }

  @RequirePermission('orders.override')
  @Post(':id/reject')
  rejectOrder(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectOrderSchema)) body: RejectOrderInput,
  ) {
    return this.orders.rejectOrder(user.id, id, body);
  }

  @RequirePermission('orders.override')
  @Patch(':id/details')
  overrideDetails(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(overrideDetailsSchema)) body: OverrideDetailsInput,
  ) {
    return this.orders.overrideDetails(user.id, id, body);
  }

  @RequirePermission('orders.read')
  @Get()
  listOrders(@Query(new ZodValidationPipe(orderListQuerySchema)) query: OrderListQueryData) {
    return this.orders.listOrders({
      page: query.page,
      pageSize: query.pageSize,
      from: query.from,
      to: query.to,
      status: query.status,
      companyId: query.companyId,
      invoiced: query.invoiced,
      search: query.search,
    });
  }

  @RequirePermission('orders.read')
  @Get(':id')
  getOrder(@Param('id') id: string) {
    return this.orders.getOrder(id);
  }

  @RequirePermission('orders.cutoff_run')
  @Post('cutoff/run')
  runCutoff() {
    return this.orders.runCutoff(new Date());
  }
}

function hasOverride(user: RequestUser): boolean {
  return user.permissions.includes('orders.override');
}
