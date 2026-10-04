'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddressInput,
  CompanyTierInput,
  CreateCompanyInput,
  DomainInput,
  HiddenSetInput,
  HolidayInput,
  SetOwnerInput,
  UpdateCompanyInput,
} from '@repo/shared';
import { apiRequest } from '@/lib/api-client';
import { notifyError, notifySuccess } from '@/lib/notify';

export interface CompanyRow {
  id: string;
  name: string;
  isActive: boolean;
  billingEmail: string;
  priceTier: { id: string; name: string } | null;
  _count: { employees: number };
}

export interface CompanyPage {
  items: CompanyRow[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CompanyDetail {
  id: string;
  name: string;
  isActive: boolean;
  billingContactName: string;
  billingEmail: string;
  billingPhone: string | null;
  billingAddress: string | null;
  ownerEmployeeId: string | null;
  priceTierId: string | null;
  workingDays: number[];
  defaultDeliveryMinute: number;
  dispatchLeadMinutes: number;
  defaultPackagingTypeId: string;
  driverInstructions: string | null;
  defaultDriverId: string | null;
  priceTier: { id: string; name: string } | null;
  defaultPackaging: { id: string; name: string };
  defaultDriver: { id: string; name: string; email: string } | null;
  owner: { id: string; name: string; email: string } | null;
  domains: Array<{ id: string; domain: string }>;
  addresses: Array<{
    id: string;
    label: string;
    line1: string;
    line2: string | null;
    city: string;
    region: string | null;
    postalCode: string;
    country: string;
    isDefault: boolean;
    isActive: boolean;
  }>;
  holidays: Array<{ id: string; date: string; name: string | null }>;
  hiddenCategories: Array<{ categoryId: string }>;
  hiddenItems: Array<{ menuItemId: string }>;
  _count: { employees: number; orders: number; invoices: number };
}

export interface DriverOption {
  id: string;
  name: string;
  email: string;
}

const COMPANIES_KEY = ['companies'] as const;

export function useCompanies(page: number, search: string): {
  data: CompanyPage | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: [...COMPANIES_KEY, 'list', page, search],
    queryFn: () =>
      apiRequest<CompanyPage>(`/api/companies?page=${page}&pageSize=20&search=${search}`),
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

export function useCompany(id: string): {
  company: CompanyDetail | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const query = useQuery({
    queryKey: [...COMPANIES_KEY, 'detail', id],
    queryFn: () => apiRequest<CompanyDetail>(`/api/companies/${id}`),
    enabled: id !== '',
  });
  return { company: query.data, isLoading: query.isLoading, isError: query.isError };
}

export function useDrivers(): { drivers: DriverOption[] | undefined } {
  const query = useQuery({
    queryKey: [...COMPANIES_KEY, 'drivers'],
    queryFn: () => apiRequest<DriverOption[]>('/api/staff/drivers'),
  });
  return { drivers: query.data };
}

function useInvalidateCompanies(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: COMPANIES_KEY });
  };
}

export function useCreateCompany(onDone: (id: string) => void): {
  create: (input: CreateCompanyInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateCompanies();
  const mutation = useMutation({
    mutationFn: (input: CreateCompanyInput) =>
      apiRequest<{ id: string }>('/api/companies', { method: 'POST', body: input }),
    onSuccess: (result) => {
      invalidate();
      notifySuccess('Company created');
      onDone(result.id);
    },
    onError: (error: unknown) => notifyError(error, 'Could not create the company'),
  });
  return { create: (input) => mutation.mutate(input), isPending: mutation.isPending };
}

export function useUpdateCompany(id: string): {
  update: (input: UpdateCompanyInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateCompanies();
  const mutation = useMutation({
    mutationFn: (input: UpdateCompanyInput) =>
      apiRequest<{ id: string }>(`/api/companies/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Company saved');
    },
    onError: (error: unknown) => notifyError(error, 'Could not save the company'),
  });
  return { update: (input) => mutation.mutate(input), isPending: mutation.isPending };
}

export function useSetCompanyActive(id: string): {
  setActive: (active: boolean) => void;
} {
  const invalidate = useInvalidateCompanies();
  const mutation = useMutation({
    mutationFn: (active: boolean) =>
      apiRequest<{ id: string }>(`/api/companies/${id}/${active ? 'activate' : 'deactivate'}`, {
        method: 'POST',
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Company updated');
    },
    onError: (error: unknown) => notifyError(error, 'Could not update the company'),
  });
  return { setActive: (active) => mutation.mutate(active) };
}

export function useSetOwner(companyId: string): { setOwner: (employeeId: string) => void } {
  const invalidate = useInvalidateCompanies();
  const mutation = useMutation({
    mutationFn: (employeeId: string) =>
      apiRequest<{ id: string }>(`/api/companies/${companyId}/owner`, {
        method: 'PUT',
        body: { employeeId },
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Owner updated');
    },
    onError: (error: unknown) => notifyError(error, 'Could not change the owner'),
  });
  return { setOwner: (employeeId) => mutation.mutate(employeeId) };
}

export function useAddAddress(companyId: string): {
  add: (input: AddressInput) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateCompanies();
  const mutation = useMutation({
    mutationFn: (input: AddressInput) =>
      apiRequest<{ id: string }>(`/api/companies/${companyId}/addresses`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Address added');
    },
    onError: (error: unknown) => notifyError(error, 'Could not add the address'),
  });
  return { add: (input) => mutation.mutate(input), isPending: mutation.isPending };
}

export function useMakeDefaultAddress(companyId: string): { makeDefault: (id: string) => void } {
  const invalidate = useInvalidateCompanies();
  const mutation = useMutation({
    mutationFn: (addressId: string) =>
      apiRequest<{ id: string }>(
        `/api/companies/${companyId}/addresses/${addressId}/make-default`,
        { method: 'POST' },
      ),
    onSuccess: () => invalidate(),
    onError: (error: unknown) => notifyError(error, 'Could not change the default address'),
  });
  return { makeDefault: (id) => mutation.mutate(id) };
}

export function useAddDomain(companyId: string): {
  add: (domain: string) => void;
  isPending: boolean;
} {
  const invalidate = useInvalidateCompanies();
  const mutation = useMutation({
    mutationFn: (domain: string) =>
      apiRequest<{ id: string }>(`/api/companies/${companyId}/domains`, {
        method: 'POST',
        body: { domain } satisfies DomainInput,
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Domain added');
    },
    onError: (error: unknown) => notifyError(error, 'Could not add the domain'),
  });
  return { add: (domain) => mutation.mutate(domain), isPending: mutation.isPending };
}

export function useRemoveDomain(companyId: string): { remove: (id: string) => void } {
  const invalidate = useInvalidateCompanies();
  const mutation = useMutation({
    mutationFn: (domainId: string) =>
      apiRequest<{ ok: true }>(`/api/companies/${companyId}/domains/${domainId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => invalidate(),
    onError: (error: unknown) => notifyError(error, 'Could not remove the domain'),
  });
  return { remove: (id) => mutation.mutate(id) };
}

export function useAddHoliday(companyId: string): {
  add: (date: string, name: string | null) => void;
} {
  const invalidate = useInvalidateCompanies();
  const mutation = useMutation({
    mutationFn: ({ date, name }: { date: string; name: string | null }) =>
      apiRequest<{ id: string }>(`/api/companies/${companyId}/holidays`, {
        method: 'POST',
        body: { date, name },
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Holiday added');
    },
    onError: (error: unknown) => notifyError(error, 'Could not add the holiday'),
  });
  return { add: (date, name) => mutation.mutate({ date, name }) };
}

export function useRemoveHoliday(companyId: string): { remove: (id: string) => void } {
  const invalidate = useInvalidateCompanies();
  const mutation = useMutation({
    mutationFn: (holidayId: string) =>
      apiRequest<{ ok: true }>(`/api/companies/${companyId}/holidays/${holidayId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => invalidate(),
    onError: (error: unknown) => notifyError(error, 'Could not remove the holiday'),
  });
  return { remove: (id) => mutation.mutate(id) };
}

export function useSetHidden(
  companyId: string,
  kind: 'hidden-categories' | 'hidden-items',
): { save: (ids: string[]) => void; isPending: boolean } {
  const invalidate = useInvalidateCompanies();
  const mutation = useMutation({
    mutationFn: (ids: string[]) =>
      apiRequest<{ ok: true }>(`/api/companies/${companyId}/${kind}`, {
        method: 'PUT',
        body: { ids } satisfies HiddenSetInput,
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Visibility saved');
    },
    onError: (error: unknown) => notifyError(error, 'Could not save visibility'),
  });
  return { save: (ids) => mutation.mutate(ids), isPending: mutation.isPending };
}

export function useSetTier(companyId: string): {
  setTier: (tierId: string | null) => void;
} {
  const invalidate = useInvalidateCompanies();
  const mutation = useMutation({
    mutationFn: (tierId: string | null) =>
      apiRequest<{ id: string }>(`/api/companies/${companyId}/tier`, {
        method: 'PUT',
        body: { priceTierId: tierId } satisfies CompanyTierInput,
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Price tier updated');
    },
    onError: (error: unknown) => notifyError(error, 'Could not change the tier'),
  });
  return { setTier: (tierId) => mutation.mutate(tierId) };
}
