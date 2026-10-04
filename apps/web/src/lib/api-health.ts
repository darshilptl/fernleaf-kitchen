/**
 * API liveness for public surfaces (footer status line, /status
 * page). Server-only: never imported by client components.
 * Returns null when unreachable, slow, or malformed — callers
 * render "degraded", never throw.
 */

export interface ApiHealth {
  ok: boolean;
}

const HEALTH_TIMEOUT_MS = 2000;

export async function getApiHealth(): Promise<ApiHealth | null> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiUrl}/api/health`, {
      signal: controller.signal,
      next: { revalidate: 30 },
    });
    if (!response.ok) {
      return null;
    }
    const payload: unknown = await response.json();
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('ok' in payload) ||
      (payload as { ok: unknown }).ok !== true
    ) {
      return null;
    }
    return { ok: true };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
