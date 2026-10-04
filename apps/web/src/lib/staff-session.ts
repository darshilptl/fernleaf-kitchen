import { cache } from 'react';
import { cookies } from 'next/headers';
import type { Session } from './session.js';

/**
 * Server-side session load for layouts and pages.
 * Cached per request: every reader in one render shares a single
 * `/me` fetch. Never a relative `/api` fetch without the cookie.
 * Returns null on any non-OK response (401 included).
 */
async function fetchStaffSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { cookie: cookieStore.toString() },
      cache: 'no-store',
    });
  } catch {
    return null;
  }
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as Session;
}

export const loadStaffSession = cache(fetchStaffSession);
