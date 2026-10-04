import { z } from 'zod';

/** Shared Zod schemas for staff management (PDF §3, D-78). */

export const staffListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type StaffListQuery = z.input<typeof staffListQuerySchema>;
export type StaffListQueryData = z.output<typeof staffListQuerySchema>;

export const createStaffSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().max(254).email(),
  roleId: z.string().uuid(),
  password: z.string().min(8).max(256),
});

export type CreateStaffInput = z.input<typeof createStaffSchema>;

export const changeRoleSchema = z.object({
  roleId: z.string().uuid(),
});

export type ChangeRoleInput = z.input<typeof changeRoleSchema>;
