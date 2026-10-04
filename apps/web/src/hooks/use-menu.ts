'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MenuCategoryInput, MenuPlacementInput, MenuPlacementUpdateInput } from '@repo/shared';
import { apiRequest } from '@/lib/api-client';
import { notifyError, notifySuccess } from '@/lib/notify';

export interface MenuCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  isSecret: boolean;
  _count: { items: number };
  items: Array<{
    id: string;
    sortOrder: number;
    isActive: boolean;
    dish: { id: string; name: string };
  }>;
}

export interface PreviewGroup {
  id: string;
  name: string;
  isRequired: boolean;
  options: Array<{ id: string; name: string; priceCents: number }>;
}

export interface PreviewItem {
  itemId: string;
  dishId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  temperature: string;
  minOrderQuantity: number | null;
  allergens: string[];
  dietaryTags: string[];
  priceCents: number;
  groups: PreviewGroup[];
}

export interface PreviewCategory {
  categoryId: string;
  name: string;
  slug: string;
  isSecret: boolean;
  items: PreviewItem[];
}

export interface MenuPreview {
  categories: PreviewCategory[];
  banner: string | null;
}

const MENU_KEY = ['menu'] as const;

export function useMenuCategories(): {
  categories: MenuCategory[] | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: [...MENU_KEY, 'categories'],
    queryFn: () => apiRequest<MenuCategory[]>('/api/menu/categories'),
  });
  return {
    categories: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}

export function useMenuPreview(employeeId: string | null, slug?: string): {
  preview: MenuPreview | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const query = useQuery({
    queryKey: [...MENU_KEY, 'preview', employeeId, slug ?? ''],
    queryFn: () =>
      apiRequest<MenuPreview>(
        `/api/menu/preview?employeeId=${employeeId}${slug === undefined || slug === '' ? '' : `&slug=${slug}`}`,
      ),
    enabled: employeeId !== null,
  });
  return { preview: query.data, isLoading: query.isLoading, isError: query.isError };
}

function useInvalidateMenu(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: MENU_KEY });
  };
}

export function useCreateCategory(onDone: () => void): {
  create: (input: MenuCategoryInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateMenu();
  const mutation = useMutation({
    mutationFn: (input: MenuCategoryInput) =>
      apiRequest<{ id: string }>('/api/menu/categories', { method: 'POST', body: input }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Category created');
      onDone();
    },
    onError: (error: unknown) => notifyError(error, 'Could not create the category'),
  });
  return { create: (input) => mutation.mutate(input), isPending: mutation.isPending };
}

export function useUpdateCategory(onDone: () => void): {
  update: (id: string, input: MenuCategoryInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateMenu();
  const mutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: MenuCategoryInput }) =>
      apiRequest<{ id: string }>(`/api/menu/categories/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Category saved');
      onDone();
    },
    onError: (error: unknown) => notifyError(error, 'Could not save the category'),
  });
  return { update: (id, input) => mutation.mutate({ id, input }), isPending: mutation.isPending };
}

export function useReorderCategories(): { reorder: (ids: string[]) => void } {
  const invalidate = useInvalidateMenu();
  const mutation = useMutation({
    mutationFn: (ids: string[]) =>
      apiRequest<{ ok: true }>('/api/menu/categories/reorder', { method: 'POST', body: { ids } }),
    onSuccess: () => invalidate(),
    onError: (error: unknown) => notifyError(error, 'Could not reorder categories'),
  });
  return { reorder: (ids) => mutation.mutate(ids) };
}

export function useDeleteCategory(): { remove: (id: string) => void } {  const invalidate = useInvalidateMenu();
  const mutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ id: string }>(`/api/menu/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Category deleted');
    },
    onError: (error: unknown) => notifyError(error, 'Could not delete the category'),
  });
  return { remove: (id) => mutation.mutate(id) };
}

export function useSetCategoryActive(): { setActive: (id: string, active: boolean) => void } {
  const invalidate = useInvalidateMenu();
  const mutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest<{ id: string }>(`/api/menu/categories/${id}/${active ? 'activate' : 'deactivate'}`, {
        method: 'POST',
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Category updated');
    },
    onError: (error: unknown) => notifyError(error, 'Could not update the category'),
  });
  return { setActive: (id, active) => mutation.mutate({ id, active }) };
}

export function useAddPlacement(categoryId: string): {
  add: (input: MenuPlacementInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateMenu();
  const mutation = useMutation({
    mutationFn: (input: MenuPlacementInput) =>
      apiRequest<{ id: string }>(`/api/menu/categories/${categoryId}/items`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Dish added');
    },
    onError: (error: unknown) => notifyError(error, 'Could not add the dish'),
  });
  return { add: (input) => mutation.mutate(input), isPending: mutation.isPending };
}

export function useUpdatePlacement(): {
  update: (itemId: string, input: MenuPlacementUpdateInput) => void;
} {
  const invalidate = useInvalidateMenu();
  const mutation = useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: MenuPlacementUpdateInput }) =>
      apiRequest<{ id: string }>(`/api/menu/items/${itemId}`, { method: 'PATCH', body: input }),
    onSuccess: () => invalidate(),
    onError: (error: unknown) => notifyError(error, 'Could not update the item'),
  });
  return { update: (itemId, input) => mutation.mutate({ itemId, input }) };
}

export function useDeletePlacement(): { remove: (itemId: string) => void } {
  const invalidate = useInvalidateMenu();
  const mutation = useMutation({
    mutationFn: (itemId: string) =>
      apiRequest<{ id: string }>(`/api/menu/items/${itemId}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Item removed');
    },
    onError: (error: unknown) => notifyError(error, 'Could not remove the item'),
  });
  return { remove: (itemId) => mutation.mutate(itemId) };
}
