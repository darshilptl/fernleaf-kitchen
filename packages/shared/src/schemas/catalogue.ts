import { z } from 'zod';

/** Shared Zod schemas for the catalogue prerequisite (PDF §4.1, Must-only). */

export const referenceItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sortOrder: z.number().int().min(0).default(0),
});

export type ReferenceItemInput = z.input<typeof referenceItemSchema>;

export const temperatureSchema = z.enum(['HOT', 'COLD']);

export const dishSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().default(null),
  imageUrl: z.string().trim().url().max(500).nullable().default(null),
  sku: z.string().trim().min(1).max(60),
  temperature: temperatureSchema,
  costCents: z.number().int().min(0),
  stationId: z.string().uuid().nullable().default(null),
  minOrderQuantity: z.number().int().min(1).nullable().default(null),
  allergenIds: z.array(z.string().uuid()).default([]),
  dietaryTagIds: z.array(z.string().uuid()).default([]),
});

export type DishInput = z.input<typeof dishSchema>;

export const optionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().default(null),
  costCents: z.number().int().min(0),
  allergenIds: z.array(z.string().uuid()).default([]),
  dietaryTagIds: z.array(z.string().uuid()).default([]),
});

export type OptionInput = z.input<typeof optionSchema>;

export const optionGroupSchema = z.object({
  name: z.string().trim().min(1).max(200),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
});

export type OptionGroupInput = z.input<typeof optionGroupSchema>;

export const groupOptionSchema = z.object({
  optionId: z.string().uuid(),
  sortOrder: z.number().int().min(0).default(0),
});

export type GroupOptionInput = z.input<typeof groupOptionSchema>;
