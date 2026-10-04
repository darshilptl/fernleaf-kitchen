'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateOrderInput,
  OverrideDetailsInput,
  RejectOrderInput,
  UpdateOrderInput,
} from '@repo/shared';
import { apiRequest } from '@/lib/api-client';
import { notifyError, notifySuccess } from '@/lib/notify';

export type OrderStatus = 'DRAFT' | 'PLACED' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED' | 'REJECTED';

export interface OrderRow {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  version: number;
  deliveryDate: string;
  deliveryTimeMinute: number;
  totalCents: number;
  invoiceId: string | null;
  employee: { id: string; name: string; email: string };
  company: { id: string; name: string };
}

export interface OrderPage {
  items: OrderRow[];
  page: number;
  pageSize: number;
  total: number;
}

export interface OrderChoice {
  id: string;
  groupName: string;
  optionId: string;
  optionName: string;
  portionSizeName: string | null;
  optionPriceCents: number;
  portionExtraCents: number;
}

export interface OrderCombination {
  id: string;
  comboKey: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  choices: OrderChoice[];
}

export interface OrderLine {
  id: string;
  dishId: string;
  dishName: string;
  dishPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  sortOrder: number;
  combinations: OrderCombination[];
}

export interface OrderEvent {
  id: string;
  type: string;
  actorId: string | null;
  note: string | null;
  createdAt: string;
}

export interface OrderDetail {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  version: number;
  employeeId: string;
  companyId: string;
  deliveryDate: string;
  deliveryTimeMinute: number;
  addressId: string;
  packagingTypeId: string;
  totalCents: number;
  invoiceId: string | null;
  dispatchReadyAt: string | null;
  outForDeliveryAt: string | null;
  employee: { id: string; name: string; email: string };
  company: { id: string; name: string };
  address: { id: string; label: string; line1: string; city: string; postalCode: string; country: string };
  packagingType: { id: string; name: string };
  lines: OrderLine[];
  events: OrderEvent[];
}

const ORDERS_KEY = ['orders'] as const;

export interface OrderFilters {
  page: number;
  from?: string;
  to?: string;
  status?: OrderStatus;
  companyId?: string;
  invoiced?: boolean;
  search: string;
}

/**
 * Order list, detail and mutations (PDF §4.6). Server-paginated;
 * filters mirror the list endpoint exactly.
 */
export function useOrders(filters: OrderFilters): {
  data: OrderPage | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: '20',
    search: filters.search,
  });
  if (filters.from !== undefined) params.set('from', filters.from);
  if (filters.to !== undefined) params.set('to', filters.to);
  if (filters.status !== undefined) params.set('status', filters.status);
  if (filters.companyId !== undefined) params.set('companyId', filters.companyId);
  if (filters.invoiced !== undefined) params.set('invoiced', String(filters.invoiced));
  const query = useQuery({
    queryKey: [...ORDERS_KEY, 'list', params.toString()],
    queryFn: () => apiRequest<OrderPage>(`/api/orders?${params.toString()}`),
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

export function useOrder(id: string): {
  order: OrderDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: [...ORDERS_KEY, 'detail', id],
    queryFn: () => apiRequest<OrderDetail>(`/api/orders/${id}`),
  });
  return {
    order: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}

function useInvalidateOrders(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
  };
}

export function useCreateOrder(onDone: (id: string) => void): {
  create: (input: CreateOrderInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateOrders();
  const mutation = useMutation({
    mutationFn: (input: CreateOrderInput) =>
      apiRequest<{ id: string; orderNumber: number }>('/api/orders', { method: 'POST', body: input }),
    onSuccess: (row) => {
      invalidate();
      notifySuccess(`Order #${row.orderNumber} created`);
      onDone(row.id);
    },
    onError: (error: unknown) => notifyError(error, 'Could not create the order'),
  });
  return { create: (input) => mutation.mutate(input), isPending: mutation.isPending };
}

export function useUpdateOrder(id: string, onDone?: () => void): {
  update: (input: UpdateOrderInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateOrders();
  const mutation = useMutation({
    mutationFn: (input: UpdateOrderInput) =>
      apiRequest<{ id: string; version: number }>(`/api/orders/${id}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Order saved');
      onDone?.();
    },
    onError: (error: unknown) => notifyError(error, 'Could not save the order'),
  });
  return { update: (input) => mutation.mutate(input), isPending: mutation.isPending };
}

export function usePlaceOrder(id: string): {
  place: (version: number) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateOrders();
  const mutation = useMutation({
    mutationFn: (version: number) =>
      apiRequest<{ id: string; version: number }>(`/api/orders/${id}/place`, {
        method: 'POST',
        body: { version },
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Order placed');
    },
    onError: (error: unknown) => notifyError(error, 'Could not place the order'),
  });
  return { place: (version) => mutation.mutate(version), isPending: mutation.isPending };
}

export function useCancelOrder(id: string): {
  cancel: (version: number) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateOrders();
  const mutation = useMutation({
    mutationFn: (version: number) =>
      apiRequest<{ id: string }>(`/api/orders/${id}/cancel`, {
        method: 'POST',
        body: { version },
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Order cancelled');
    },
    onError: (error: unknown) => notifyError(error, 'Could not cancel the order'),
  });
  return { cancel: (version) => mutation.mutate(version), isPending: mutation.isPending };
}

export function useRejectOrder(id: string, onDone: () => void): {
  reject: (input: RejectOrderInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateOrders();
  const mutation = useMutation({
    mutationFn: (input: RejectOrderInput) =>
      apiRequest<{ id: string }>(`/api/orders/${id}/reject`, { method: 'POST', body: input }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Order rejected');
      onDone();
    },
    onError: (error: unknown) => notifyError(error, 'Could not reject the order'),
  });
  return { reject: (input) => mutation.mutate(input), isPending: mutation.isPending };
}

export function useOverrideDetails(id: string): {
  override: (input: OverrideDetailsInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateOrders();
  const mutation = useMutation({
    mutationFn: (input: OverrideDetailsInput) =>
      apiRequest<{ id: string; version: number }>(`/api/orders/${id}/details`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Delivery details updated');
    },
    onError: (error: unknown) => notifyError(error, 'Could not update the details'),
  });
  return { override: (input) => mutation.mutate(input), isPending: mutation.isPending };
}

export function useRunCutoff(): { run: () => void; isPending: boolean } {
  const invalidate = useInvalidateOrders();
  const mutation = useMutation({
    mutationFn: () =>
      apiRequest<{ processedDates: string[]; cancelled: number; confirmed: number }>(
        '/api/orders/cutoff/run',
        { method: 'POST' },
      ),
    onSuccess: (result) => {
      invalidate();
      notifySuccess(
        'Cut-off processed',
        `${result.confirmed} confirmed, ${result.cancelled} cancelled`,
      );
    },
    onError: (error: unknown) => notifyError(error, 'Could not run the cut-off'),
  });
  return { run: () => mutation.mutate(), isPending: mutation.isPending };
}
