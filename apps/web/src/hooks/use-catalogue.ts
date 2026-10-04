'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DishInput,
  GroupOptionInput,
  OptionGroupInput,
  OptionInput,
  ReferenceItemInput,
} from '@repo/shared';
import { apiRequest } from '@/lib/api-client';
import { notifyError, notifySuccess } from '@/lib/notify';

export interface ReferenceRow {
  id: string;
  name: string;
  sortOrder: number | null;
  isActive: boolean;
}

export const REFERENCE_LISTS = [
  { key: 'allergens', label: 'Allergens' },
  { key: 'dietary-tags', label: 'Dietary tags' },
  { key: 'stations', label: 'Kitchen stations' },
  { key: 'portion-sizes', label: 'Portion sizes' },
  { key: 'packaging-types', label: 'Packaging types' },
] as const;

export type ReferenceListKey = (typeof REFERENCE_LISTS)[number]['key'];

/**
 * Admin reference lists (allergens, tags, stations, portions,
 * packaging). Read-only here; catalogue management UI is out of
 * scope for Group 2 (backend only, per plan).
 */
export function useReferenceList(list: string): {
  rows: ReferenceRow[] | undefined;
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: ['catalogue', 'reference', list],
    queryFn: () => apiRequest<ReferenceRow[]>(`/api/reference/${list}`),
  });
  return { rows: query.data?.filter((row) => row.isActive), isLoading: query.isLoading };
}

export interface DishRow {
  id: string;
  name: string;
  sku: string;
  isActive: boolean;
}

export interface DishPage {
  items: DishRow[];
  page: number;
  pageSize: number;
  total: number;
}

export interface DishGroupOption {
  option: { id: string; name: string; isActive: boolean };
  sortOrder: number;
}

export interface DishGroup {
  id: string;
  name: string;
  isRequired: boolean;
  sortOrder: number;
  options: DishGroupOption[];
}

export interface DishDetail {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sku: string;
  temperature: 'HOT' | 'COLD';
  costCents: number;
  stationId: string | null;
  minOrderQuantity: number | null;
  isActive: boolean;
  station: { id: string; name: string } | null;
  allergens: Array<{ allergen: { id: string; name: string } }>;
  dietaryTags: Array<{ tag: { id: string; name: string } }>;
  optionGroups: DishGroup[];
}

export interface OptionRow {
  id: string;
  name: string;
  isActive: boolean;
}

export interface OptionPage {
  items: OptionRow[];
  page: number;
  pageSize: number;
  total: number;
}

const CATALOGUE_KEY = ['catalogue'] as const;

export function useDishes(page: number): {
  data: DishPage | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: [...CATALOGUE_KEY, 'dishes', page],
    queryFn: () => apiRequest<DishPage>(`/api/dishes?page=${page}&pageSize=20`),
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

export function useDish(id: string | null): { dish: DishDetail | undefined; isLoading: boolean } {
  const query = useQuery({
    queryKey: [...CATALOGUE_KEY, 'dish', id],
    queryFn: () => apiRequest<DishDetail>(`/api/dishes/${id}`),
    enabled: id !== null,
  });
  return { dish: query.data, isLoading: query.isLoading };
}

export function useOptions(page: number): {
  data: OptionPage | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: [...CATALOGUE_KEY, 'options', page],
    queryFn: () => apiRequest<OptionPage>(`/api/options?page=${page}&pageSize=20`),
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

function useInvalidateCatalogue(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: CATALOGUE_KEY });
  };
}

export function useCreateDish(onDone: (id: string) => void): {
  create: (input: DishInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateCatalogue();
  const mutation = useMutation({
    mutationFn: (input: DishInput) =>
      apiRequest<{ id: string }>('/api/dishes', { method: 'POST', body: input }),
    onSuccess: (result) => {
      invalidate();
      notifySuccess('Dish created');
      onDone(result.id);
    },
    onError: (error: unknown) => notifyError(error, 'Could not create the dish'),
  });
  return { create: (input) => mutation.mutate(input), isPending: mutation.isPending };
}

export function useUpdateDish(id: string): {
  update: (input: DishInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateCatalogue();
  const mutation = useMutation({
    mutationFn: (input: DishInput) =>
      apiRequest<{ id: string }>(`/api/dishes/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Dish saved');
    },
    onError: (error: unknown) => notifyError(error, 'Could not save the dish'),
  });
  return { update: (input) => mutation.mutate(input), isPending: mutation.isPending };
}

export function useSetDishActive(): { setActive: (id: string, active: boolean) => void } {
  const invalidate = useInvalidateCatalogue();
  const mutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest<{ id: string }>(`/api/dishes/${id}/${active ? 'activate' : 'deactivate'}`, {
        method: 'POST',
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Dish updated');
    },
    onError: (error: unknown) => notifyError(error, 'Could not update the dish'),
  });
  return { setActive: (id, active) => mutation.mutate({ id, active }) };
}

export function useCreateOption(onDone: () => void): {
  create: (input: OptionInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateCatalogue();
  const mutation = useMutation({
    mutationFn: (input: OptionInput) =>
      apiRequest<{ id: string }>('/api/options', { method: 'POST', body: input }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Option created');
      onDone();
    },
    onError: (error: unknown) => notifyError(error, 'Could not create the option'),
  });
  return { create: (input) => mutation.mutate(input), isPending: mutation.isPending };
}

export function useSetOptionActive(): { setActive: (id: string, active: boolean) => void } {
  const invalidate = useInvalidateCatalogue();
  const mutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest<{ id: string }>(`/api/options/${id}/${active ? 'activate' : 'deactivate'}`, {
        method: 'POST',
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Option updated');
    },
    onError: (error: unknown) => notifyError(error, 'Could not update the option'),
  });
  return { setActive: (id, active) => mutation.mutate({ id, active }) };
}

export function useCreateGroup(dishId: string): {
  create: (input: OptionGroupInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateCatalogue();
  const mutation = useMutation({
    mutationFn: (input: OptionGroupInput) =>
      apiRequest<{ id: string }>(`/api/dishes/${dishId}/groups`, { method: 'POST', body: input }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Group added');
    },
    onError: (error: unknown) => notifyError(error, 'Could not add the group'),
  });
  return { create: (input) => mutation.mutate(input), isPending: mutation.isPending };
}

export function useUpdateGroup(): {
  update: (id: string, input: OptionGroupInput) => void;
} {
  const invalidate = useInvalidateCatalogue();
  const mutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: OptionGroupInput }) =>
      apiRequest<{ id: string }>(`/api/groups/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Group saved');
    },
    onError: (error: unknown) => notifyError(error, 'Could not save the group'),
  });
  return { update: (id, input) => mutation.mutate({ id, input }) };
}

export function useDeleteGroup(): { remove: (id: string) => void } {
  const invalidate = useInvalidateCatalogue();
  const mutation = useMutation({
    mutationFn: (id: string) => apiRequest<{ id: string }>(`/api/groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Group deleted');
    },
    onError: (error: unknown) => notifyError(error, 'Could not delete the group'),
  });
  return { remove: (id) => mutation.mutate(id) };
}

export function useOptionsList(page: number): {
  data: OptionPage | undefined;
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: [...CATALOGUE_KEY, 'options', page],
    queryFn: () => apiRequest<OptionPage>(`/api/options?page=${page}&pageSize=100`),
  });
  return { data: query.data, isLoading: query.isLoading };
}

export function useAttachOption(groupId: string): {
  attach: (input: GroupOptionInput) => void;
} {
  const invalidate = useInvalidateCatalogue();
  const mutation = useMutation({
    mutationFn: (input: GroupOptionInput) =>
      apiRequest<{ ok: true }>(`/api/groups/${groupId}/options`, { method: 'POST', body: input }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Option attached');
    },
    onError: (error: unknown) => notifyError(error, 'Could not attach the option'),
  });
  return { attach: (input) => mutation.mutate(input) };
}

export function useDetachOption(): { detach: (groupId: string, optionId: string) => void } {
  const invalidate = useInvalidateCatalogue();
  const mutation = useMutation({
    mutationFn: ({ groupId, optionId }: { groupId: string; optionId: string }) =>
      apiRequest<{ ok: true }>(`/api/groups/${groupId}/options/${optionId}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Option detached');
    },
    onError: (error: unknown) => notifyError(error, 'Could not detach the option'),
  });
  return { detach: (groupId, optionId) => mutation.mutate({ groupId, optionId }) };
}

export function useCreateReference(
  list: string,
  onDone: () => void,
): {
  create: (input: ReferenceItemInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateCatalogue();
  const mutation = useMutation({
    mutationFn: (input: ReferenceItemInput) =>
      apiRequest<{ id: string }>(`/api/reference/${list}`, { method: 'POST', body: input }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Entry created');
      onDone();
    },
    onError: (error: unknown) => notifyError(error, 'Could not create the entry'),
  });
  return { create: (input) => mutation.mutate(input), isPending: mutation.isPending };
}

export function useSetReferenceActive(
  list: string,
): {
  setActive: (id: string, active: boolean) => void;
} {
  const invalidate = useInvalidateCatalogue();
  const mutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest<{ id: string }>(`/api/reference/${list}/${id}/${active ? 'activate' : 'deactivate'}`, {
        method: 'POST',
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Entry updated');
    },
    onError: (error: unknown) => notifyError(error, 'Could not update the entry'),
  });
  return { setActive: (id, active) => mutation.mutate({ id, active }) };
}

export function useUpdateReference(
  list: string,
  onDone: () => void,
): {
  update: (id: string, input: ReferenceItemInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateCatalogue();
  const mutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReferenceItemInput }) =>
      apiRequest<{ id: string }>(`/api/reference/${list}/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Entry renamed');
      onDone();
    },
    onError: (error: unknown) => notifyError(error, 'Could not rename the entry'),
  });
  return { update: (id, input) => mutation.mutate({ id, input }), isPending: mutation.isPending };
}
