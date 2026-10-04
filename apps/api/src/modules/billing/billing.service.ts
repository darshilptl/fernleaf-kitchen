import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError, fromDbDate } from '@repo/shared';
import type { InvoiceListQueryData } from '@repo/shared';
import { PrismaService } from '../../database/prisma.service.js';
import { ClockService } from '../../common/clock/clock.service.js';
import { logAction } from '../../common/logging/logging.interceptor.js';

/**
 * Company billing. PDF §4.9 / D-53, D-74.
 *
 * Billable = `status IN (CONFIRMED, DELIVERED)` AND `invoiceId IS
 * NULL` (D-53). `Order.invoiceId` is a single nullable column, so
 * an order is on at most one invoice. `Invoice.totalCents` is
 * frozen at creation and always equals the sum of its members.
 *
 * Algorithm (create, one transaction):
 *   1. Lock the candidate rows (`FOR UPDATE`); row count must equal
 *      `orderIds.length`, else 409 `INVOICE_ORDERS_NOT_BILLABLE`.
 *   2. `totalCents = sum(rows)`; insert the invoice; link the rows.
 * Pay is a one-way conditional write (`paidAt IS NULL`), else 409.
 * Removal locks the invoice row; paid -> 409 `INVOICE_PAID_IMMUTABLE`;
 * unlink exactly one row, recompute the total, delete the invoice
 * when empty. Cancel/reject of invoiced orders stays blocked in
 * `transitionOrder` (G3 `requireUninvoiced`); time/address/packaging
 * overrides are allowed with no billing effect. A short delivery is
 * not modelled and stays billed in full (documented limitation).
 * Invariants: every multi-write is one transaction; no nesting.
 * Edge cases: parallel creates over one order -> one 409; paid
 * twice -> 409; last-order removal deletes the invoice.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  async billable(companyId: string): Promise<unknown> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (company === null) {
      throw new DomainError({
        code: 'COMPANY_NOT_FOUND',
        message: 'Company not found',
        httpStatus: 404,
      });
    }
    const orders = await this.prisma.order.findMany({
      where: {
        companyId,
        invoiceId: null,
        status: { in: ['CONFIRMED', 'DELIVERED'] },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        deliveryDate: true,
        deliveryTimeMinute: true,
        totalCents: true,
        employee: { select: { id: true, name: true } },
      },
      orderBy: [{ deliveryDate: 'asc' }, { orderNumber: 'asc' }],
    });
    return {
      companyId,
      orders: orders.map((row) => ({ ...row, deliveryDate: fromDbDate(row.deliveryDate) })),
    };
  }

  async createInvoice(
    companyId: string,
    orderIds: string[],
    actorId: string,
  ): Promise<{ id: string; invoiceNumber: number; totalCents: number }> {
    const uniqueIds = [...new Set(orderIds)];
    const created = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; totalCents: number }>>`
        SELECT id, "totalCents" FROM orders
        WHERE id IN (${Prisma.join(uniqueIds)}) AND "companyId" = ${companyId}
          AND "invoiceId" IS NULL AND status IN ('CONFIRMED', 'DELIVERED')
        FOR UPDATE`;
      if (rows.length !== uniqueIds.length) {
        throw new DomainError({
          code: 'INVOICE_ORDERS_NOT_BILLABLE',
          message: 'Every order must be billable and belong to the company',
          httpStatus: 409,
        });
      }
      const totalCents = rows.reduce((sum, row) => sum + row.totalCents, 0);
      const invoice = await tx.invoice.create({
        data: { companyId, createdById: actorId, totalCents },
        select: { id: true, invoiceNumber: true, totalCents: true },
      });
      await tx.order.updateMany({
        where: { id: { in: uniqueIds } },
        data: { invoiceId: invoice.id },
      });
      return invoice;
    });
    logAction(this.logger, 'billing.invoice.create', {
      invoice: created.id,
      actor: actorId,
      orders: uniqueIds.length,
    });
    return created;
  }

  async listInvoices(query: InvoiceListQueryData): Promise<{
    items: unknown[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    const where = {
      ...(query.companyId !== undefined ? { companyId: query.companyId } : {}),
      ...(query.paid !== undefined ? (query.paid ? { paidAt: { not: null } } : { paidAt: null }) : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        select: {
          id: true,
          invoiceNumber: true,
          companyId: true,
          totalCents: true,
          paidAt: true,
          createdAt: true,
          company: { select: { id: true, name: true } },
          _count: { select: { orders: true } },
        },
        orderBy: { invoiceNumber: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async getInvoice(id: string): Promise<unknown> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            deliveryDate: true,
            deliveryTimeMinute: true,
            totalCents: true,
            employee: { select: { id: true, name: true } },
          },
          orderBy: { orderNumber: 'asc' },
        },
      },
    });
    if (invoice === null) {
      throw new DomainError({
        code: 'INVOICE_NOT_FOUND',
        message: 'Invoice not found',
        httpStatus: 404,
      });
    }
    return {
      ...invoice,
      orders: invoice.orders.map((row) => ({ ...row, deliveryDate: fromDbDate(row.deliveryDate) })),
    };
  }

  async markPaid(id: string, actorId: string): Promise<{ id: string }> {
    const now = this.clock.now();
    const changed = await this.prisma.invoice.updateMany({
      where: { id, paidAt: null },
      data: { paidAt: now, paidById: actorId },
    });
    if (changed.count === 0) {
      const existing = await this.prisma.invoice.findUnique({
        where: { id },
        select: { id: true, paidAt: true },
      });
      if (existing === null) {
        throw new DomainError({
          code: 'INVOICE_NOT_FOUND',
          message: 'Invoice not found',
          httpStatus: 404,
        });
      }
      throw new DomainError({
        code: 'INVOICE_ALREADY_PAID',
        message: 'Invoice is already paid',
        httpStatus: 409,
      });
    }
    logAction(this.logger, 'billing.invoice.pay', { invoice: id, actor: actorId });
    return { id };
  }

  async removeOrder(
    invoiceId: string,
    orderId: string,
    actorId: string,
  ): Promise<{ id: string; totalCents: number } | { deleted: true }> {
    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string; paidAt: Date | null }>>`
        SELECT id, "paidAt" FROM invoices WHERE id = ${invoiceId} FOR UPDATE`;
      const invoice = locked[0];
      if (invoice === undefined) {
        throw new DomainError({
          code: 'INVOICE_NOT_FOUND',
          message: 'Invoice not found',
          httpStatus: 404,
        });
      }
      if (invoice.paidAt !== null) {
        throw new DomainError({
          code: 'INVOICE_PAID_IMMUTABLE',
          message: 'Paid invoices cannot change',
          httpStatus: 409,
        });
      }
      const unlinked = await tx.order.updateMany({
        where: { id: orderId, invoiceId },
        data: { invoiceId: null },
      });
      if (unlinked.count === 0) {
        throw new DomainError({
          code: 'VALIDATION_ERROR',
          path: 'orderId',
          message: 'Order is not on this invoice',
          httpStatus: 400,
        });
      }
      const remaining = await tx.order.findMany({
        where: { invoiceId },
        select: { totalCents: true },
      });
      if (remaining.length === 0) {
        await tx.invoice.delete({ where: { id: invoiceId } });
        return { deleted: true as const };
      }
      const totalCents = remaining.reduce((sum, row) => sum + row.totalCents, 0);
      await tx.invoice.update({ where: { id: invoiceId }, data: { totalCents } });
      return { id: invoiceId, totalCents };
    });
    logAction(this.logger, 'billing.invoice.remove-order', {
      invoice: invoiceId,
      order: orderId,
      actor: actorId,
    });
    return result;
  }
}
