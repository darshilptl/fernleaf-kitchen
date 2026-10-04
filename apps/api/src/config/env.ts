import { z } from 'zod';

/**
 * Validated process environment. PDF §4.10 / §7.
 *
 * Single place that reads process.env. Every other file takes
 * values as parameters (constructor args, function inputs) so
 * tests control them. Never use `process.env.X!` anywhere else.
 */

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached === undefined) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues
        .map((issue) => issue.path.join('.'))
        .join(', ');
      throw new Error(`Invalid environment: ${missing}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export function isProduction(env: Env = getEnv()): boolean {
  return env.NODE_ENV === 'production';
}

/** Test-only: reset the cache between specs that mutate process.env. */
export function resetEnvCache(): void {
  cached = undefined;
}
