import { z } from 'zod';

/** Shared Zod schemas for employees (PDF §4.5). */

export const employeeFlagsSchema = z.object({
  canChooseAddress: z.boolean().default(false),
  canChangeDeliveryTime: z.boolean().default(false),
  canChangePackaging: z.boolean().default(false),
});

export const createEmployeeSchema = employeeFlagsSchema.extend({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().max(254).email(),
  allergenIds: z.array(z.string().uuid()).default([]),
  dietaryTagIds: z.array(z.string().uuid()).default([]),
});

export type CreateEmployeeInput = z.input<typeof createEmployeeSchema>;

export const updateEmployeeSchema = employeeFlagsSchema.partial().extend({
  name: z.string().trim().min(1).max(200).optional(),
  companyId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  allergenIds: z.array(z.string().uuid()).optional(),
  dietaryTagIds: z.array(z.string().uuid()).optional(),
});

export type UpdateEmployeeInput = z.input<typeof updateEmployeeSchema>;

export const employeeCsvRowSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().max(254).email(),
});

export type EmployeeCsvRow = z.input<typeof employeeCsvRowSchema>;

export const csvImportSchema = z.object({
  content: z.string().min(1).max(2_000_000),
});

export type CsvImportInput = z.input<typeof csvImportSchema>;
