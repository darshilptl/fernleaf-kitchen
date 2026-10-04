'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { KitchenHolidayInput, SettingsInput } from '@repo/shared';
import { apiRequest } from '@/lib/api-client';
import { notifyError, notifySuccess } from '@/lib/notify';

export interface PlatformSettings {
  kitchenWorkingDays: number[];
  cutoffTimeMinute: number;
  cutoffWorkingDays: number;
  atRiskMinutes: number;
}

export interface KitchenHoliday {
  id: string;
  date: string;
  name: string | null;
}

const SETTINGS_KEY = ['settings'] as const;

/**
 * Platform settings and kitchen holidays (PDF §4.10).
 * One query key; every mutation invalidates it.
 */
export function useSettings(): {
  settings: PlatformSettings | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: [...SETTINGS_KEY, 'row'],
    queryFn: () => apiRequest<PlatformSettings>('/api/settings'),
  });
  return {
    settings: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}

export function useHolidays(): {
  holidays: KitchenHoliday[] | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: [...SETTINGS_KEY, 'holidays'],
    queryFn: () => apiRequest<KitchenHoliday[]>('/api/settings/holidays'),
  });
  return {
    holidays: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}

function useInvalidateSettings(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
  };
}

export function useUpdateSettings(): {
  update: (input: SettingsInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateSettings();
  const mutation = useMutation({
    mutationFn: (input: SettingsInput) =>
      apiRequest<{ id: number }>('/api/settings', { method: 'PATCH', body: input }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Settings saved');
    },
    onError: (error: unknown) => notifyError(error, 'Could not save the settings'),
  });
  return { update: (input) => mutation.mutate(input), isPending: mutation.isPending };
}

export function useAddHoliday(onDone: () => void): {
  add: (input: KitchenHolidayInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateSettings();
  const mutation = useMutation({
    mutationFn: (input: KitchenHolidayInput) =>
      apiRequest<{ id: string }>('/api/settings/holidays', { method: 'POST', body: input }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Holiday added');
      onDone();
    },
    onError: (error: unknown) => notifyError(error, 'Could not add the holiday'),
  });
  return { add: (input) => mutation.mutate(input), isPending: mutation.isPending };
}

export function useRemoveHoliday(): { remove: (id: string) => void } {
  const invalidate = useInvalidateSettings();
  const mutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ ok: true }>(`/api/settings/holidays/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Holiday removed');
    },
    onError: (error: unknown) => notifyError(error, 'Could not remove the holiday'),
  });
  return { remove: (id) => mutation.mutate(id) };
}

export function useRefreshDemoData(): { refresh: () => void; isPending: boolean } {
  const invalidate = useInvalidateSettings();
  const mutation = useMutation({
    mutationFn: () =>
      apiRequest<{ orders: number; invoices: number; skipped: boolean }>(
        '/api/settings/demo-data/refresh',
        { method: 'POST' },
      ),
    onSuccess: (result) => {
      invalidate();
      notifySuccess(
        result.skipped ? 'Demo data already present' : `Demo data refreshed: ${result.orders} orders`,
      );
    },
    onError: (error: unknown) => notifyError(error, 'Could not refresh demo data'),
  });
  return { refresh: () => mutation.mutate(), isPending: mutation.isPending };
}
