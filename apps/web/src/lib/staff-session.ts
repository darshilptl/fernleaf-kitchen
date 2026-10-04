import { cookies } from 'next/headers';
import type { Session } from './session.js';

/**
 * Server-side session load for the (staff) layout and pages.
 * Fetches the absolute API_URL and forwards async cookies() —
 * never a relative /api fetch without the cookie header.
 * Returns null on any non-OK response (401 included).
 */
export async function loadStaffSession(): Promise<Session | null> {
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
