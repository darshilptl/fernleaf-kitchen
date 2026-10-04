'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import { notifyError, notifySuccess } from '@/lib/notify';

export interface BillableOrder {
  id: string;
  orderNumber: number;
  status: 'CONFIRMED' | 'DELIVERED';
  deliveryDate: string;
  deliveryTimeMinute: number;
  totalCents: number;
  employee: { id: string; name: string };
}

export interface InvoiceRow {
  id: string;
  invoiceNumber: number;
  companyId: string;
  totalCents: number;
  paidAt: string | null;
  createdAt: string;
  company: { id: string; name: string };
  _count: { orders: number };
}

export interface InvoicePage {
  items: InvoiceRow[];
  page: number;
  pageSize: number;
  total: number;
}

export interface InvoiceDetail extends InvoiceRow {
  orders: BillableOrder[];
}

const BILLING_KEY = ['billing'] as const;

/**
 * Company billing: per-company billable orders, invoice creation,
 * the invoice list, invoice detail, pay, and removal from unpaid
 * invoices (PDF §4.9).
 */
export function useBillable(companyId: string): {
  orders: BillableOrder[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: [...BILLING_KEY, 'billable', companyId],
    queryFn: () =>
      apiRequest<{ companyId: string; orders: BillableOrder[] }>(
        `/api/billing/companies/${companyId}/billable`,
      ),
    enabled: companyId !== '',
  });
  return {
    orders: query.data?.orders ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}

function useInvalidateBilling(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: BILLING_KEY });
  };
}

export function useCreateInvoice(onDone: (id: string) => void): {
  create: (companyId: string, orderIds: string[]) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateBilling();
  const mutation = useMutation({
    mutationFn: ({ companyId, orderIds }: { companyId: string; orderIds: string[] }) =>
      apiRequest<{ id: string; invoiceNumber: number; totalCents: number }>('/api/billing/invoices', {
        method: 'POST',
        body: { companyId, orderIds },
      }),
    onSuccess: (row) => {
      invalidate();
      notifySuccess(`Invoice #${row.invoiceNumber} created`);
      onDone(row.id);
    },
    onError: (error: unknown) => notifyError(error, 'Could not create the invoice'),
  });
  return {
    create: (companyId, orderIds) => mutation.mutate({ companyId, orderIds }),
    isPending: mutation.isPending,
  };
}

export function useInvoices(page: number, companyId?: string, paid?: boolean): {
  data: InvoicePage | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (companyId !== undefined && companyId !== '') {
    params.set('companyId', companyId);
  }
  if (paid !== undefined) {
    params.set('paid', String(paid));
  }
  const query = useQuery({
    queryKey: [...BILLING_KEY, 'invoices', params.toString()],
    queryFn: () => apiRequest<InvoicePage>(`/api/billing/invoices?${params.toString()}`),
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

export function useInvoice(id: string): {
  invoice: InvoiceDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: [...BILLING_KEY, 'invoice', id],
    queryFn: () => apiRequest<InvoiceDetail>(`/api/billing/invoices/${id}`),
  });
  return {
    invoice: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}

export function usePayInvoice(id: string): { pay: () => void; isPending: boolean } {
  const invalidate = useInvalidateBilling();
  const mutation = useMutation({
    mutationFn: () => apiRequest<{ id: string }>(`/api/billing/invoices/${id}/pay`, { method: 'POST' }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Invoice marked paid');
    },
    onError: (error: unknown) => notifyError(error, 'Could not mark the invoice paid'),
  });
  return { pay: () => mutation.mutate(), isPending: mutation.isPending };
}

export function useRemoveInvoiceOrder(id: string): {
  remove: (orderId: string) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateBilling();
  const mutation = useMutation({
    mutationFn: (orderId: string) =>
      apiRequest<{ id: string; totalCents: number } | { deleted: true }>(
        `/api/billing/invoices/${id}/remove-order`,
        { method: 'POST', body: { orderId } },
      ),
    onSuccess: () => {
      invalidate();
      notifySuccess('Order removed from the invoice');
    },
    onError: (error: unknown) => notifyError(error, 'Could not remove the order'),
  });
  return { remove: (orderId) => mutation.mutate(orderId), isPending: mutation.isPending };
}
