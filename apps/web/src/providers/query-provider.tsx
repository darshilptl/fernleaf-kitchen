'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Wraps the login page and the (staff) layout subtree so neither
 * touches the user's root layout. One client per mount; no
 * persistence, no devtools, no extra state library.
 */
export function QueryProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
