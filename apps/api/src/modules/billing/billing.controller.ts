import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { createInvoiceSchema, invoiceListQuerySchema, removeInvoiceOrderSchema } from '@repo/shared';
import type {
  CreateInvoiceInput,
  InvoiceListQueryData,
  RemoveInvoiceOrderInput,
} from '@repo/shared';
import { CurrentUser, RequirePermission } from '../auth/auth.decorator.js';
import type { RequestUser } from '../auth/auth.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { BillingService } from './billing.service.js';

/**
 * Billing endpoints. PDF §4.9.
 *
 * `billing.read` lists billable orders and invoices;
 * `billing.manage` creates invoices, marks paid, and removes
 * orders from unpaid invoices.
 */
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @RequirePermission('billing.read')
  @Get('companies/:id/billable')
  billable(@Param('id') id: string) {
    return this.billing.billable(id);
  }

  @RequirePermission('billing.manage')
  @Post('invoices')
  createInvoice(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createInvoiceSchema)) body: CreateInvoiceInput,
  ) {
    return this.billing.createInvoice(body.companyId, body.orderIds, user.id);
  }

  @RequirePermission('billing.read')
  @Get('invoices')
  listInvoices(@Query(new ZodValidationPipe(invoiceListQuerySchema)) query: InvoiceListQueryData) {
    return this.billing.listInvoices(query);
  }

  @RequirePermission('billing.read')
  @Get('invoices/:id')
  getInvoice(@Param('id') id: string) {
    return this.billing.getInvoice(id);
  }

  @RequirePermission('billing.manage')
  @Post('invoices/:id/pay')
  markPaid(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.billing.markPaid(id, user.id);
  }

  @RequirePermission('billing.manage')
  @Post('invoices/:id/remove-order')
  removeOrder(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(removeInvoiceOrderSchema)) body: RemoveInvoiceOrderInput,
  ) {
    return this.billing.removeOrder(id, body.orderId, user.id);
  }
}
