'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SESSION_QUERY_KEY } from '@/hooks/use-session';
import { subscribeSessionChanged } from '@/lib/session-broadcast';
import type { Session } from '@/lib/session';

/** One client per browser so every mount shares a single session cache. */
let browserClient: QueryClient | undefined;

function getSharedClient(): QueryClient {
  if (browserClient === undefined) {
    browserClient = new QueryClient();
  }
  return browserClient;
}

/**
 * Wraps the login page and the (staff) layout subtree so neither
 * touches the user's root layout. Seeds the session cache with
 * the server-resolved value, so first paint already matches the
 * cookie. Broadcasts from other tabs invalidate the cache.
 */
export function QueryProvider({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession: Session | null;
}): React.JSX.Element {
  const [client] = useState(() => {
    const next = getSharedClient();
    next.setQueryData(SESSION_QUERY_KEY, initialSession);
    return next;
  });
  useEffect(
    () =>
      subscribeSessionChanged(() => {
        void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      }),
    [client],
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
