'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BatchPricesInput,
  PriceTierInput,
  TierRuleInput,
} from '@repo/shared';
import { apiRequest } from '@/lib/api-client';
import { notifyError, notifySuccess } from '@/lib/notify';

export interface PriceTier {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  derivationBasis: 'COST' | 'TIER' | null;
  sourceTierId: string | null;
  multiplierBp: number | null;
}

export interface GridRow {
  id: string;
  name: string;
  kind: 'dish' | 'option';
  manualCents: number | null;
  effectiveCents: number | null;
  source: 'MANUAL' | 'DERIVED' | 'NONE';
}

const TIERS_KEY = ['pricing', 'tiers'] as const;

export function usePriceTiers(): {
  tiers: PriceTier[] | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: TIERS_KEY,
    queryFn: () => apiRequest<PriceTier[]>('/api/pricing/tiers'),
  });
  return {
    tiers: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}

export function useTierGrid(
  tierId: string | null,
  missingOnly: boolean,
): {
  rows: GridRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: ['pricing', 'grid', tierId, missingOnly],
    queryFn: () =>
      apiRequest<GridRow[]>(`/api/pricing/tiers/${tierId}/grid?missingOnly=${missingOnly}`),
    enabled: tierId !== null,
  });
  return {
    rows: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}

function useInvalidatePricing(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['pricing'] });
  };
}

export function useCreateTier(onDone: () => void): {
  create: (input: PriceTierInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidatePricing();
  const mutation = useMutation({
    mutationFn: (input: PriceTierInput) =>
      apiRequest<{ id: string }>('/api/pricing/tiers', { method: 'POST', body: input }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Tier created');
      onDone();
    },
    onError: (error: unknown) => notifyError(error, 'Could not create the tier'),
  });
  return { create: (input) => mutation.mutate(input), isPending: mutation.isPending };
}

export function useMakeDefault(): { makeDefault: (id: string) => void; isPending: boolean } {
  const invalidate = useInvalidatePricing();
  const mutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ id: string }>(`/api/pricing/tiers/${id}/make-default`, { method: 'POST' }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Default tier updated');
    },
    onError: (error: unknown) => notifyError(error, 'Could not change the default tier'),
  });
  return { makeDefault: (id) => mutation.mutate(id), isPending: mutation.isPending };
}

export function useSaveRule(tierId: string): {
  save: (input: TierRuleInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidatePricing();
  const mutation = useMutation({
    mutationFn: (input: TierRuleInput) =>
      apiRequest<{ id: string }>(`/api/pricing/tiers/${tierId}/rule`, {
        method: 'PUT',
        body: input,
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Pricing rule saved');
    },
    onError: (error: unknown) => notifyError(error, 'Could not save the rule'),
  });
  return { save: (input) => mutation.mutate(input), isPending: mutation.isPending };
}

export function useSaveBatchPrices(tierId: string, onSaved?: () => void): {
  save: (input: BatchPricesInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidatePricing();
  const mutation = useMutation({
    mutationFn: (input: BatchPricesInput) =>
      apiRequest<{ ok: true }>(`/api/pricing/tiers/${tierId}/prices`, {
        method: 'PUT',
        body: input,
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Prices saved');
      onSaved?.();
    },
    onError: (error: unknown) => notifyError(error, 'Could not save prices'),
  });
  return { save: (input) => mutation.mutate(input), isPending: mutation.isPending };
}

export function useClearTypedPrice(tierId: string): {
  clear: (kind: 'dish' | 'option', itemId: string) => void;
} {
  const invalidate = useInvalidatePricing();
  const mutation = useMutation({
    mutationFn: ({ kind, itemId }: { kind: 'dish' | 'option'; itemId: string }) =>
      apiRequest<{ ok: true }>(`/api/pricing/tiers/${tierId}/prices/${kind}/${itemId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => invalidate(),
    onError: (error: unknown) => notifyError(error, 'Could not clear the price'),
  });
  return { clear: (kind, itemId) => mutation.mutate({ kind, itemId }) };
}

export function useSetTierActive(): { setActive: (id: string, active: boolean) => void } {
  const invalidate = useInvalidatePricing();
  const mutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest<{ id: string }>(
        `/api/pricing/tiers/${id}/${active ? 'activate' : 'deactivate'}`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      invalidate();
      notifySuccess('Tier updated');
    },
    onError: (error: unknown) => notifyError(error, 'Could not update the tier'),
  });
  return { setActive: (id, active) => mutation.mutate({ id, active }) };
}
