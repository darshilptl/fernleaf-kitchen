'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateCompanySchema } from '@repo/shared';
import type { UpdateCompanyInput } from '@repo/shared';
import { Button } from '@repo/ui/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@repo/ui/components/ui/field';
import { Input } from '@repo/ui/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { ApiError } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/apply-server-errors';
import {
  useCompany,
  useDrivers,
  useSetCompanyActive,
  useSetOwner,
  useSetTier,
  useUpdateCompany,
} from '@/hooks/use-companies';
import { useEmployees } from '@/hooks/use-employees';
import { usePriceTiers } from '@/hooks/use-pricing';
import { useReferenceList } from '@/hooks/use-catalogue';

/**
 * Company profile tab: editable billing + delivery defaults,
 * owner reassignment, tier link, activation toggle.
 */
export function CompanyProfileTab({ companyId }: { companyId: string }): React.JSX.Element {
  const { company } = useCompany(companyId);
  const { update, isPending } = useUpdateCompany(companyId);
  const { setActive } = useSetCompanyActive(companyId);
  const { setOwner } = useSetOwner(companyId);
  const { setTier } = useSetTier(companyId);
  const { drivers } = useDrivers();
  const { tiers } = usePriceTiers();
  const { rows: packagingTypes } = useReferenceList('packaging-types');
  const { data: employeePage } = useEmployees(companyId, 1);
  const form = useForm<UpdateCompanyInput>({
    resolver: zodResolver(updateCompanySchema),
  });

  useEffect(() => {
    if (company !== undefined) {
      form.reset({
        name: company.name,
        billingContactName: company.billingContactName,
        billingEmail: company.billingEmail,
        billingPhone: company.billingPhone,
        billingAddress: company.billingAddress,
        workingDays: company.workingDays,
        defaultDeliveryMinute: company.defaultDeliveryMinute,
        dispatchLeadMinutes: company.dispatchLeadMinutes,
        driverInstructions: company.driverInstructions,
      });
    }
  }, [company, form]);

  if (company === undefined) {
    return <p className="text-body-sm">Loading company…</p>;
  }

  function handleSubmit(input: UpdateCompanyInput): void {
    try {
      update(input);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        applyServerErrors(form, error);
      }
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit(handleSubmit)();
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="company-name">Company name</FieldLabel>
            <Input id="company-name" {...form.register('name')} />
          </Field>
          <Field>
            <FieldLabel htmlFor="billing-contact">Billing contact</FieldLabel>
            <Input id="billing-contact" {...form.register('billingContactName')} />
          </Field>
          <Field>
            <FieldLabel htmlFor="billing-email">Billing email</FieldLabel>
            <Input id="billing-email" type="email" {...form.register('billingEmail')} />
          </Field>
          <Field>
            <FieldLabel htmlFor="delivery-minute">Default delivery time (minutes)</FieldLabel>
            <Input
              id="delivery-minute"
              type="number"
              {...form.register('defaultDeliveryMinute', { valueAsNumber: true })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="lead-minutes">Dispatch lead minutes</FieldLabel>
            <Input
              id="lead-minutes"
              type="number"
              {...form.register('dispatchLeadMinutes', { valueAsNumber: true })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="driver-instructions">Driver instructions</FieldLabel>
            <Input id="driver-instructions" {...form.register('driverInstructions')} />
          </Field>
          <div>
            <Button type="submit" size="sm" disabled={isPending}>
              Save profile
            </Button>
          </div>
        </FieldGroup>
      </form>
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-body-sm">Price tier</span>
          <Select
            value={company.priceTierId ?? ''}
            onValueChange={(value) => setTier(value === '' ? null : value)}
          >
            <SelectTrigger aria-label="Price tier" className="w-64">
              <SelectValue placeholder="Default tier" />
            </SelectTrigger>
            <SelectContent>
<SelectGroup>
              {(tiers ?? []).map((tier) => (
                <SelectItem key={tier.id} value={tier.id}>
                  {tier.name}
                </SelectItem>
              ))}
            </SelectGroup>
</SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-body-sm">Packaging</span>
          <Select
            value={company.defaultPackagingTypeId}
            onValueChange={(value) => {
              if (value !== '' && value !== null) {
                update({ defaultPackagingTypeId: value });
              }
            }}
          >
            <SelectTrigger aria-label="Packaging" className="w-64">
              <SelectValue placeholder="Pick packaging" />
            </SelectTrigger>
            <SelectContent>
<SelectGroup>
              {(packagingTypes ?? []).map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectGroup>
</SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-body-sm">Default driver</span>
          <Select
            value={company.defaultDriverId ?? ''}
            onValueChange={(value) =>
              update({ defaultDriverId: value === '' ? null : value })
            }
          >
            <SelectTrigger aria-label="Default driver" className="w-64">
              <SelectValue placeholder="No default driver" />
            </SelectTrigger>
            <SelectContent>
<SelectGroup>
              {(drivers ?? []).map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.name}
                </SelectItem>
              ))}
            </SelectGroup>
</SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-body-sm">
            Owner: {company.owner === null ? 'none' : company.owner.name}
          </span>
          <Select
            value={company.ownerEmployeeId ?? ''}
            onValueChange={(value) => {
              if (value !== '' && value !== null) {
                setOwner(value);
              }
            }}
          >
            <SelectTrigger aria-label="Change owner" className="w-64">
              <SelectValue placeholder="Change owner" />
            </SelectTrigger>
            <SelectContent>
<SelectGroup>
              {(employeePage?.items ?? []).map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.name}
                </SelectItem>
              ))}
            </SelectGroup>
</SelectContent>
          </Select>
        </div>
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActive(!company.isActive)}
          >
            {company.isActive ? 'Deactivate company' : 'Activate company'}
          </Button>
        </div>
      </div>
    </div>
  );
}
