'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import { notifyError, notifySuccess } from '@/lib/notify';
import type { DropGroup } from './use-dispatch';

export interface OwnDrops {
  date: string;
  drops: DropGroup[];
}

const DRIVER_KEY = ['driver-drops'] as const;

/**
 * Driver view: only the signed-in driver own drops for today,
 * in time order, at any stage (PDF §4.8). Delivery is enabled
 * only when out for delivery; the server enforces it.
 */
export function useOwnDrops(): {
  data: OwnDrops | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: DRIVER_KEY,
    queryFn: () => apiRequest<OwnDrops>('/api/deliveries/today'),
  });
  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}

export function useMarkDelivered(): {
  deliver: (key: DropGroup['key'], note?: string, photoUrl?: string) => void;
  isPending: boolean;
} {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({
      key,
      note,
      photoUrl,
    }: {
      key: DropGroup['key'];
      note?: string;
      photoUrl?: string;
    }) =>
      apiRequest<{ updated: number }>('/api/deliveries/drops/delivered', {
        method: 'POST',
        body: { ...key, ...(note === undefined ? {} : { note }), ...(photoUrl === undefined ? {} : { photoUrl }) },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DRIVER_KEY });
      notifySuccess('Drop delivered');
    },
    onError: (error: unknown) => notifyError(error, 'Could not mark the drop delivered'),
  });
  return {
    deliver: (key, note, photoUrl) => mutation.mutate({ key, note, photoUrl }),
    isPending: mutation.isPending,
  };
}
