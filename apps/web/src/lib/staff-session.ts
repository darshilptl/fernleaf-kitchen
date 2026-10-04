import { cache } from 'react';
import { cookies } from 'next/headers';
import { sessionSchema } from '@repo/shared';
import type { Session } from './session.js';

/**
 * Server-side session load for layouts and pages.
 * Cached per request: every reader in one render shares a single
 * `/me` fetch. Never a relative `/api` fetch without the cookie.
 * Returns null on any non-OK response (401 included) or when the
 * payload fails the shared contract (fails closed, never casts).
 */
async function fetchStaffSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  let payload: unknown;
  try {
    const response = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { cookie: cookieStore.toString() },
      cache: 'no-store',
    });
    if (!response.ok) {
      return null;
    }
    payload = (await response.json()) as unknown;
  } catch {
    return null;
  }
  const parsed = sessionSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

export const loadStaffSession = cache(fetchStaffSession);
