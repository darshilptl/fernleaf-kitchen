import { z } from 'zod';

/**
 * Login input. Used by the Nest Zod pipe AND react-hook-form
 * via zodResolver, so client and server parse the same shape.
 * Password length policy is format-only here (min 1): the four
 * reviewer accounts are fixed and wrong passwords must yield the
 * same AUTH_INVALID_CREDENTIALS message either way.
 */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  password: z.string().min(1).max(256),
});

export type LoginInput = z.infer<typeof loginSchema>;
