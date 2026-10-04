import type { ApiErrorItem } from '@repo/shared';

/**
 * Single API client for the web app. Parses the
 * `{ code, path, message }[]` error shape and maps `path`
 * entries 1:1 onto form fields via applyServerErrors.
 * The browser only calls relative `/api/*` URLs, which the
 * Next rewrite forwards so the auth cookie stays first-party.
 */
export class ApiError extends Error {
  readonly items: ApiErrorItem[];

  constructor(items: ApiErrorItem[]) {
    super(items[0]?.message ?? 'Request failed');
    this.name = 'ApiError';
    this.items = items;
  }

  fieldErrors(): Array<{ path: string; message: string }> {
    const fields: Array<{ path: string; message: string }> = [];
    for (const item of this.items) {
      if (item.path !== undefined) {
        fields.push({ path: item.path, message: item.message });
      }
    }
    return fields;
  }
}

function isErrorItems(value: unknown): value is ApiErrorItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item): item is ApiErrorItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as { code?: unknown }).code === 'string' &&
        typeof (item as { message?: unknown }).message === 'string',
    )
  );
}

interface RequestOptions {
  method?: string;
  body?: unknown;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: 'include',
  });
  if (response.ok) {
    return (await response.json()) as T;
  }
  let items: ApiErrorItem[] = [{ code: 'REQUEST_ERROR', message: 'Request failed' }];
  try {
    const parsed: unknown = await response.json();
    if (isErrorItems(parsed)) {
      items = parsed;
    }
  } catch {
    // Non-JSON failure (proxy/route crash): keep the generic item.
  }
  throw new ApiError(items);
}
