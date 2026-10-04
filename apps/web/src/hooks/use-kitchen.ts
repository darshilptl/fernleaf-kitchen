'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import { notifyError, notifySuccess } from '@/lib/notify';

export type Lateness = 'DONE' | 'LATE' | 'AT_RISK' | 'ON_TRACK';

export interface KitchenUnit {
  id: string;
  orderId: string;
  orderNumber: number;
  version: number;
  deliveryTimeMinute: number;
  companyName: string;
  dishName: string;
  stationId: string | null;
  stationName: string;
  quantity: number;
  startedAt: string | null;
  doneAt: string | null;
  lateness: Lateness;
}

export interface KitchenBoard {
  date: string;
  units: KitchenUnit[];
}

const KITCHEN_KEY = ['kitchen'] as const;

/**
 * Kitchen board for a delivery date with an optional station
 * filter, plus start/done/force-complete mutations (PDF §4.7).
 * Late and at-risk styling is computed server-side per unit.
 */
export function useKitchenBoard(date: string, station: string): {
  data: KitchenBoard | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const params = new URLSearchParams();
  if (date !== '') {
    params.set('date', date);
  }
  if (station !== '') {
    params.set('station', station);
  }
  const query = useQuery({
    queryKey: [...KITCHEN_KEY, 'board', params.toString()],
    queryFn: () => apiRequest<KitchenBoard>(`/api/kitchen/board?${params.toString()}`),
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

function useInvalidateKitchen(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: KITCHEN_KEY });
  };
}

export function useStartUnit(): { start: (id: string) => void; isPending: boolean } {
  const invalidate = useInvalidateKitchen();
  const mutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ id: string }>(`/api/kitchen/units/${id}/start`, { method: 'POST' }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Unit started');
    },
    onError: (error: unknown) => notifyError(error, 'Could not start the unit'),
  });
  return { start: (id) => mutation.mutate(id), isPending: mutation.isPending };
}

export function useDoneUnit(): { done: (id: string) => void; isPending: boolean } {
  const invalidate = useInvalidateKitchen();
  const mutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ id: string }>(`/api/kitchen/units/${id}/done`, { method: 'POST' }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Unit done');
    },
    onError: (error: unknown) => notifyError(error, 'Could not finish the unit'),
  });
  return { done: (id) => mutation.mutate(id), isPending: mutation.isPending };
}

export function useForceComplete(): {
  forceComplete: (orderId: string, version: number) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateKitchen();
  const mutation = useMutation({
    mutationFn: ({ orderId, version }: { orderId: string; version: number }) =>
      apiRequest<{ id: string; version: number }>(`/api/kitchen/orders/${orderId}/force-complete`, {
        method: 'POST',
        body: { version },
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Order force-completed');
    },
    onError: (error: unknown) => notifyError(error, 'Could not force-complete the order'),
  });
  return {
    forceComplete: (orderId, version) => mutation.mutate({ orderId, version }),
    isPending: mutation.isPending,
  };
}
