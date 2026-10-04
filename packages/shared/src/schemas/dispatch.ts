import { z } from 'zod';

/** Shared Zod schemas for dispatch drops and the driver view (PDF §4.8). */

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const dropKeySchema = z.object({
  companyId: z.string().uuid(),
  addressId: z.string().uuid(),
  deliveryDate: dateSchema,
  deliveryTimeMinute: z.number().int().min(0).max(1439),
});

export type DropKeyInput = z.input<typeof dropKeySchema>;
export type DropKeyData = z.output<typeof dropKeySchema>;

export const assignDriverSchema = dropKeySchema.extend({
  driverId: z.string().uuid(),
});

export type AssignDriverInput = z.input<typeof assignDriverSchema>;

export const dispatchDropsQuerySchema = z.object({
  date: dateSchema.optional(),
});

export type DispatchDropsQuery = z.input<typeof dispatchDropsQuerySchema>;
export type DispatchDropsQueryData = z.output<typeof dispatchDropsQuerySchema>;

export const markDeliveredSchema = dropKeySchema.extend({
  note: z.string().trim().max(500).optional(),
  photoUrl: z.string().trim().url().max(2000).optional(),
});

export type MarkDeliveredInput = z.input<typeof markDeliveredSchema>;
