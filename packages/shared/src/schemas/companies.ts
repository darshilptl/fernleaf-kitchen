import { z } from 'zod';

/** Shared Zod schemas for companies (PDF §4.4). */

const isoWeekdaySchema = z.number().int().min(1).max(7);

export const createCompanySchema = z.object({
  name: z.string().trim().min(1).max(200),
  billingContactName: z.string().trim().min(1).max(200),
  billingEmail: z.string().trim().toLowerCase().max(254).email(),
  billingPhone: z.string().trim().max(60).nullable().default(null),
  billingAddress: z.string().trim().max(500).nullable().default(null),
  domains: z.array(z.string().trim().min(1).max(253)).min(1).max(20),
  addresses: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        line1: z.string().trim().min(1).max(300),
        line2: z.string().trim().max(300).nullable().default(null),
        city: z.string().trim().min(1).max(120),
        region: z.string().trim().max(120).nullable().default(null),
        postalCode: z.string().trim().min(1).max(30),
        country: z.string().trim().min(1).max(120),
        isDefault: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(50),
  ownerName: z.string().trim().min(1).max(200),
  ownerEmail: z.string().trim().toLowerCase().max(254).email(),
  workingDays: z.array(isoWeekdaySchema).min(1).max(7).default([1, 2, 3, 4, 5]),
  defaultDeliveryMinute: z.number().int().min(0).max(1439),
  dispatchLeadMinutes: z.number().int().min(0).max(720).default(60),
  defaultPackagingTypeId: z.string().uuid(),
  driverInstructions: z.string().trim().max(2000).nullable().default(null),
  defaultDriverId: z.string().uuid().nullable().default(null),
  priceTierId: z.string().uuid().nullable().default(null),
});

export type CreateCompanyInput = z.input<typeof createCompanySchema>;

export const updateCompanySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  billingContactName: z.string().trim().min(1).max(200).optional(),
  billingEmail: z.string().trim().toLowerCase().max(254).email().optional(),
  billingPhone: z.string().trim().max(60).nullable().optional(),
  billingAddress: z.string().trim().max(500).nullable().optional(),
  workingDays: z.array(isoWeekdaySchema).min(1).max(7).optional(),
  defaultDeliveryMinute: z.number().int().min(0).max(1439).optional(),
  dispatchLeadMinutes: z.number().int().min(0).max(720).optional(),
  defaultPackagingTypeId: z.string().uuid().optional(),
  driverInstructions: z.string().trim().max(2000).nullable().optional(),
  defaultDriverId: z.string().uuid().nullable().optional(),
  priceTierId: z.string().uuid().nullable().optional(),
});

export type UpdateCompanyInput = z.input<typeof updateCompanySchema>;

export const addressSchema = z.object({
  label: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(300),
  line2: z.string().trim().max(300).nullable().default(null),
  city: z.string().trim().min(1).max(120),
  region: z.string().trim().max(120).nullable().default(null),
  postalCode: z.string().trim().min(1).max(30),
  country: z.string().trim().min(1).max(120),
  isDefault: z.boolean().default(false),
});

export type AddressInput = z.input<typeof addressSchema>;

export const domainSchema = z.object({
  domain: z.string().trim().min(1).max(253),
});

export type DomainInput = z.input<typeof domainSchema>;

export const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  name: z.string().trim().max(200).nullable().default(null),
});

export type HolidayInput = z.input<typeof holidaySchema>;

export const hiddenSetSchema = z.object({
  ids: z.array(z.string().uuid()).max(5000),
});

export type HiddenSetInput = z.input<typeof hiddenSetSchema>;

export const companyTierSchema = z.object({
  priceTierId: z.string().uuid().nullable(),
});

export type CompanyTierInput = z.input<typeof companyTierSchema>;

export const setOwnerSchema = z.object({
  employeeId: z.string().uuid(),
});

export type SetOwnerInput = z.input<typeof setOwnerSchema>;

export const companyListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).default(''),
  active: z.coerce.boolean().optional(),
});

export type CompanyListQuery = z.input<typeof companyListQuerySchema>;
export type CompanyListQueryData = z.output<typeof companyListQuerySchema>;
