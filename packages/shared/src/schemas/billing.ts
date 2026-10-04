import { z } from 'zod';

/** Shared Zod schemas for company billing (PDF §4.9). */

export const createInvoiceSchema = z.object({
  companyId: z.string().uuid(),
  orderIds: z.array(z.string().uuid()).min(1).max(500),
});

export type CreateInvoiceInput = z.input<typeof createInvoiceSchema>;

export const removeInvoiceOrderSchema = z.object({
  orderId: z.string().uuid(),
});

export type RemoveInvoiceOrderInput = z.input<typeof removeInvoiceOrderSchema>;

export const invoiceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  companyId: z.string().uuid().optional(),
  paid: z.coerce.boolean().optional(),
});

export type InvoiceListQuery = z.input<typeof invoiceListQuerySchema>;
export type InvoiceListQueryData = z.output<typeof invoiceListQuerySchema>;
