'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import { notifyError, notifySuccess } from '@/lib/notify';

export interface DropKey {
  companyId: string;
  addressId: string;
  deliveryDate: string;
  deliveryTimeMinute: number;
}

export type DropStatus =
  | 'CONFIRMED'
  | 'KITCHEN_READY'
  | 'DISPATCH_READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED';

export interface DropMember {
  id: string;
  companyId: string;
  addressId: string;
  deliveryTimeMinute: number;
  kitchenReadyAt: string | null;
  dispatchReadyAt: string | null;
  outForDeliveryAt: string | null;
  driverId: string | null;
  company?: { name: string; defaultDriverId: string | null };
  address?: { label: string; line1: string; city: string };
  driver?: { id: string; name: string } | null;
}

export interface DropGroup {
  key: DropKey;
  status: DropStatus;
  memberIds: string[];
  members: DropMember[];
}

export interface DropsBoard {
  date: string;
  drops: DropGroup[];
}

const DISPATCH_KEY = ['dispatch'] as const;

/**
 * Dispatch board (drops for a date) and whole-drop steps
 * (PDF §4.8). Assign defaults to the company default driver in
 * the UI; the server treats it as an ordinary driver id.
 */
export function useDispatchDrops(date: string): {
  data: DropsBoard | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const params = date === '' ? '' : `?date=${date}`;
  const query = useQuery({
    queryKey: [...DISPATCH_KEY, 'drops', date],
    queryFn: () => apiRequest<DropsBoard>(`/api/dispatch/drops${params}`),
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

function useInvalidateDispatch(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: DISPATCH_KEY });
  };
}

export function useAssignDriver(): {
  assign: (key: DropKey, driverId: string) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateDispatch();
  const mutation = useMutation({
    mutationFn: ({ key, driverId }: { key: DropKey; driverId: string }) =>
      apiRequest<{ updated: number }>('/api/dispatch/drops/assign', {
        method: 'POST',
        body: { ...key, driverId },
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Driver assigned');
    },
    onError: (error: unknown) => notifyError(error, 'Could not assign the driver'),
  });
  return { assign: (key, driverId) => mutation.mutate({ key, driverId }), isPending: mutation.isPending };
}

export function useDispatchStep(step: 'dispatch-ready' | 'out-for-delivery'): {
  advance: (key: DropKey) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateDispatch();
  const mutation = useMutation({
    mutationFn: (key: DropKey) =>
      apiRequest<{ updated: number }>(`/api/dispatch/drops/${step}`, {
        method: 'POST',
        body: key,
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess(step === 'dispatch-ready' ? 'Drop dispatch ready' : 'Drop out for delivery');
    },
    onError: (error: unknown) => notifyError(error, 'Could not move the drop'),
  });
  return { advance: (key) => mutation.mutate(key), isPending: mutation.isPending };
}
