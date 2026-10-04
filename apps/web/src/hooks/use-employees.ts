'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateEmployeeInput, UpdateEmployeeInput } from '@repo/shared';
import { apiRequest } from '@/lib/api-client';
import { notifyError, notifySuccess } from '@/lib/notify';

export interface EmployeeRow {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  canChooseAddress: boolean;
  canChangeDeliveryTime: boolean;
  canChangePackaging: boolean;
}

export interface EmployeePage {
  items: EmployeeRow[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CsvImportResult {
  imported: number;
  errors: Array<{ row: number; message: string }>;
}

const EMPLOYEES_KEY = ['employees'] as const;

export function useEmployees(companyId: string, page: number): {
  data: EmployeePage | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: [...EMPLOYEES_KEY, companyId, page],
    queryFn: () =>
      apiRequest<EmployeePage>(`/api/companies/${companyId}/employees?page=${page}&pageSize=20`),
    enabled: companyId !== '',
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

function useInvalidateEmployees(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY });
    void queryClient.invalidateQueries({ queryKey: ['companies'] });
  };
}

export function useCreateEmployee(companyId: string, onDone: () => void): {
  create: (input: CreateEmployeeInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateEmployees();
  const mutation = useMutation({
    mutationFn: (input: CreateEmployeeInput) =>
      apiRequest<{ id: string }>(`/api/companies/${companyId}/employees`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Employee added');
      onDone();
    },
    onError: (error: unknown) => notifyError(error, 'Could not add the employee'),
  });
  return { create: (input) => mutation.mutate(input), isPending: mutation.isPending };
}

export function useUpdateEmployee(onDone: () => void): {
  update: (id: string, input: UpdateEmployeeInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateEmployees();
  const mutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEmployeeInput }) =>
      apiRequest<{ id: string }>(`/api/employees/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Employee saved');
      onDone();
    },
    onError: (error: unknown) => notifyError(error, 'Could not save the employee'),
  });
  return { update: (id, input) => mutation.mutate({ id, input }), isPending: mutation.isPending };
}

export function useSetEmployeeActive(): {
  setActive: (id: string, active: boolean) => void;
} {
  const invalidate = useInvalidateEmployees();
  const mutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest<{ id: string }>(`/api/employees/${id}/${active ? 'activate' : 'deactivate'}`, {
        method: 'POST',
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Employee updated');
    },
    onError: (error: unknown) => notifyError(error, 'Could not update the employee'),
  });
  return { setActive: (id, active) => mutation.mutate({ id, active }) };
}

export function useImportCsv(companyId: string): {
  importCsv: (content: string) => void;
  isPending: boolean;
  result: CsvImportResult | undefined;
  reset: () => void;
} {
  const invalidate = useInvalidateEmployees();
  const mutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest<CsvImportResult>(`/api/companies/${companyId}/employees/import`, {
        method: 'POST',
        body: { content },
      }),
    onSuccess: (result) => {
      invalidate();
      notifySuccess(`Imported ${result.imported} employees`, `${result.errors.length} rows had errors`);
    },
    onError: (error: unknown) => notifyError(error, 'Could not import the file'),
  });
  return {
    importCsv: (content) => mutation.mutate(content),
    isPending: mutation.isPending,
    result: mutation.data,
    reset: () => mutation.reset(),
  };
}
