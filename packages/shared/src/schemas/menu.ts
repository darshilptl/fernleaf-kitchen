import { z } from 'zod';

/** Shared Zod schemas for menus (PDF §4.2). */

export const menuCategorySchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with dashes')
    .nullable()
    .default(null),
  description: z.string().trim().max(2000).nullable().default(null),
  sortOrder: z.number().int().min(0).default(0),
  isSecret: z.boolean().default(false),
});

export type MenuCategoryInput = z.input<typeof menuCategorySchema>;

export const menuPlacementSchema = z.object({
  dishId: z.string().uuid(),
  sortOrder: z.number().int().min(0).default(0),
});

export type MenuPlacementInput = z.input<typeof menuPlacementSchema>;

export const menuPlacementUpdateSchema = z.object({
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export type MenuPlacementUpdateInput = z.input<typeof menuPlacementUpdateSchema>;

export const reorderSchema = z.object({
  ids: z.array(z.string().uuid()).max(5000),
});

export type ReorderInput = z.input<typeof reorderSchema>;

export const menuPreviewQuerySchema = z.object({
  employeeId: z.string().uuid(),
  slug: z.string().trim().max(200).optional(),
});

export type MenuPreviewQuery = z.input<typeof menuPreviewQuerySchema>;
