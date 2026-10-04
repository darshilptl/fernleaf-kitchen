import { z } from 'zod';

/** Shared Zod schemas for platform settings (PDF §4.10). */

export const settingsSchema = z.object({
  kitchenWorkingDays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  cutoffTimeMinute: z.number().int().min(0).max(1439),
  cutoffWorkingDays: z.number().int().min(0).max(365),
  atRiskMinutes: z.number().int().min(0).max(1440),
});

export type SettingsInput = z.input<typeof settingsSchema>;

export const kitchenHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  name: z.string().trim().max(200).nullable().default(null),
});

export type KitchenHolidayInput = z.input<typeof kitchenHolidaySchema>;
