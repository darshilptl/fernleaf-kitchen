import { z } from 'zod';

/** Shared Zod schemas for orders (PDF §4.6). D-88: a draft needs employee + date. */

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const orderChoiceSchema = z.object({
  optionId: z.string().uuid(),
  portionSizeId: z.string().uuid().nullable().default(null),
});

export type OrderChoiceInput = z.input<typeof orderChoiceSchema>;

export const orderCombinationSchema = z.object({
  quantity: z.number().int().min(1).max(10000),
  choices: z.array(orderChoiceSchema).max(50),
});

export type OrderCombinationInput = z.input<typeof orderCombinationSchema>;

export const orderLineSchema = z.object({
  dishId: z.string().uuid(),
  combinations: z.array(orderCombinationSchema).min(1).max(200),
});

export type OrderLineInput = z.input<typeof orderLineSchema>;

export const orderDetailsSchema = z.object({
  addressId: z.string().uuid(),
  deliveryTimeMinute: z.number().int().min(0).max(1439),
  packagingTypeId: z.string().uuid(),
});

export type OrderDetailsInput = z.input<typeof orderDetailsSchema>;

export const createOrderSchema = z.object({
  employeeId: z.string().uuid(),
  deliveryDate: dateSchema,
  details: orderDetailsSchema.optional(),
  lines: z.array(orderLineSchema).max(500).default([]),
});

export type CreateOrderInput = z.input<typeof createOrderSchema>;

export const updateOrderSchema = z.object({
  version: z.number().int().min(0),
  details: orderDetailsSchema.optional(),
  lines: z.array(orderLineSchema).max(500).optional(),
});

export type UpdateOrderInput = z.input<typeof updateOrderSchema>;

const versionSchema = z.object({
  version: z.number().int().min(0),
});

export type OrderVersionInput = z.input<typeof versionSchema>;
export { versionSchema };

export const rejectOrderSchema = z.object({
  version: z.number().int().min(0),
  reason: z.string().trim().min(1).max(500),
});

export type RejectOrderInput = z.input<typeof rejectOrderSchema>;

export const overrideDetailsSchema = z.object({
  version: z.number().int().min(0),
  addressId: z.string().uuid().optional(),
  deliveryTimeMinute: z.number().int().min(0).max(1439).optional(),
  packagingTypeId: z.string().uuid().optional(),
});

export type OverrideDetailsInput = z.input<typeof overrideDetailsSchema>;

export const orderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  status: z.enum(['DRAFT', 'PLACED', 'CONFIRMED', 'DELIVERED', 'CANCELLED', 'REJECTED']).optional(),
  companyId: z.string().uuid().optional(),
  invoiced: z.coerce.boolean().optional(),
  search: z.string().trim().max(200).default(''),
});

export type OrderListQuery = z.input<typeof orderListQuerySchema>;
export type OrderListQueryData = z.output<typeof orderListQuerySchema>;
