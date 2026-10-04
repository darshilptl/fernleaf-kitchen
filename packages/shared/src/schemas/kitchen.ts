import { z } from 'zod';

/** Shared Zod schemas for the kitchen board (PDF §4.7). */

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const kitchenBoardQuerySchema = z.object({
  date: dateSchema.optional(),
  station: z.string().uuid().optional(),
});

export type KitchenBoardQuery = z.input<typeof kitchenBoardQuerySchema>;
export type KitchenBoardQueryData = z.output<typeof kitchenBoardQuerySchema>;

export const forceCompleteSchema = z.object({
  version: z.number().int().min(0),
});

export type ForceCompleteInput = z.input<typeof forceCompleteSchema>;
