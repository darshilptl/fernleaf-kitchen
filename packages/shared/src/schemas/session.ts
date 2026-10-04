import { z } from 'zod';

/**
 * Session payload shape returned by GET /api/auth/me.
 * The web staff-session helper validates with this instead of
 * casting, so a contract drift fails closed (null) rather than
 * rendering a malformed session. Display-only fields included.
 */
export const sessionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().max(254).email(),
  roleName: z.string().min(1),
  permissions: z.array(z.string().min(1)),
  landingPath: z.string().min(1),
});

export type SessionPayload = z.infer<typeof sessionSchema>;
