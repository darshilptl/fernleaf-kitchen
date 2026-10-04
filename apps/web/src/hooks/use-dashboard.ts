'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';

export interface StatusSlice {
  status: string;
  count: number;
  totalCents: number;
}

export interface CompanySlice {
  companyId: string;
  companyName: string;
  count: number;
  totalCents: number;
}

export interface AdminFigures {
  byStatus: StatusSlice[];
  unbilledTotalCents: number;
  topCompanies: CompanySlice[];
  unpaidCount: number;
  unpaidTotalCents: number;
  oldestUnpaidAgeDays: number | null;
  pricingGapDishes: number;
}

/**
 * Admin figures (PDF §4.11, definitions in docs/dashboards.md).
 * Server-computed; the browser only renders.
 */
export function useAdminFigures(): {
  figures: AdminFigures | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: ['dashboards', 'admin'],
    queryFn: () => apiRequest<AdminFigures>('/api/dashboards/admin'),
  });
  return {
    figures: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}
