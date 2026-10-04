'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChangeRoleInput, CreateStaffInput } from '@repo/shared';
import { apiRequest } from '@/lib/api-client';
import { notifyError, notifySuccess } from '@/lib/notify';

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
}

export interface StaffPage {
  items: StaffRow[];
  page: number;
  pageSize: number;
  total: number;
}

export interface RoleOption {
  id: string;
  name: string;
}

const STAFF_KEY = ['staff'] as const;

export function useStaff(page: number): {
  data: StaffPage | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: [...STAFF_KEY, 'list', page],
    queryFn: () => apiRequest<StaffPage>(`/api/staff?page=${page}&pageSize=20`),
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

export function useRoles(): { roles: RoleOption[] | undefined } {
  const query = useQuery({
    queryKey: [...STAFF_KEY, 'roles'],
    queryFn: () => apiRequest<RoleOption[]>('/api/staff/roles'),
  });
  return { roles: query.data };
}

function useInvalidateStaff(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: STAFF_KEY });
  };
}

export function useCreateStaff(onDone: () => void): {
  create: (input: CreateStaffInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateStaff();
  const mutation = useMutation({
    mutationFn: (input: CreateStaffInput) =>
      apiRequest<{ id: string }>('/api/staff', { method: 'POST', body: input }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Staff account created');
      onDone();
    },
    onError: (error: unknown) => notifyError(error, 'Could not create the account'),
  });
  return { create: (input) => mutation.mutate(input), isPending: mutation.isPending };
}

export function useChangeRole(onDone: () => void): {
  change: (id: string, input: ChangeRoleInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateStaff();
  const mutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ChangeRoleInput }) =>
      apiRequest<{ id: string }>(`/api/staff/${id}/role`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Role changed');
      onDone();
    },
    onError: (error: unknown) => notifyError(error, 'Could not change the role'),
  });
  return { change: (id, input) => mutation.mutate({ id, input }), isPending: mutation.isPending };
}

export function useSetStaffActive(): {
  setActive: (id: string, active: boolean) => void;
} {
  const invalidate = useInvalidateStaff();
  const mutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest<{ id: string }>(`/api/staff/${id}/${active ? 'activate' : 'deactivate'}`, {
        method: 'POST',
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Staff account updated');
    },
    onError: (error: unknown) => notifyError(error, 'Could not update the account'),
  });
  return { setActive: (id, active) => mutation.mutate({ id, active }) };
}
