'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api-client';
import type { Session } from '@/lib/session';

export const SESSION_QUERY_KEY = ['session'] as const;

/**
 * Loads the session via GET /api/auth/me. 401 yields null (the
 * staff layout handles redirects on the server; pages treat
 * null as signed-out). No useEffect fetching: TanStack Query
 * owns the request. Mutations invalidate SESSION_QUERY_KEY.
 */
export function useSession(): {
  session: Session | null | undefined;
  isLoading: boolean;
  isError: boolean;
  logout: () => Promise<void>;
} {
  const queryClient = useQueryClient();
  const router = useRouter();
  const query = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async (): Promise<Session | null> => {
      try {
        return await apiRequest<Session>('/api/auth/me');
      } catch (error: unknown) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'items' in error &&
          Array.isArray((error as { items: unknown }).items) &&
          (error as { items: Array<{ code?: unknown }> }).items.some(
            (item) => item.code === 'AUTH_REQUIRED',
          )
        ) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  async function logout(): Promise<void> {
    await apiRequest<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
    queryClient.setQueryData(SESSION_QUERY_KEY, null);
    router.push('/login');
  }

  return {
    session: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    logout,
  };
}
