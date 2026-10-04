'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createCompanySchema } from '@repo/shared';
import type { CreateCompanyInput } from '@repo/shared';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
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
import { useCreateCompany, useDrivers } from '@/hooks/use-companies';
import { useReferenceList } from '@/hooks/use-catalogue';
import { usePriceTiers } from '@/hooks/use-pricing';

/**
 * Company creation with its owner employee. The first address
 * becomes the default; further addresses live in the detail
 * tabs. Packaging and driver come from admin reference data.
 */
export function CompanyDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const router = useRouter();
  const { create, isPending } = useCreateCompany((id) => {
    onClose();
    router.push(`/admin/companies/${id}`);
  });
  const { drivers } = useDrivers();
  const { tiers } = usePriceTiers();
  const { rows: packagingTypes } = useReferenceList('packaging-types');
  const form = useForm<CreateCompanyInput>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      domains: [''],
      addresses: [
        {
          label: 'HQ',
          line1: '',
          city: '',
          postalCode: '',
          country: '',
          isDefault: true,
        },
      ],
    },
  });
  const serverError = form.formState.errors.root?.server?.message;

  function handleSubmit(input: CreateCompanyInput): void {
    try {
      create(input);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        applyServerErrors(form, error);
      }
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-h-svh overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New company</DialogTitle>
        </DialogHeader>
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
              <FieldLabel htmlFor="domain">Email domain</FieldLabel>
              <Input
                id="domain"
                placeholder="acme.in"
                {...form.register('domains.0')}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="owner-name">Owner name</FieldLabel>
              <Input id="owner-name" {...form.register('ownerName')} />
            </Field>
            <Field>
              <FieldLabel htmlFor="owner-email">Owner email</FieldLabel>
              <Input id="owner-email" type="email" {...form.register('ownerEmail')} />
            </Field>
            <Field>
              <FieldLabel htmlFor="address-line1">First address, line 1</FieldLabel>
              <Input id="address-line1" {...form.register('addresses.0.line1')} />
            </Field>
            <Field>
              <FieldLabel htmlFor="address-city">City</FieldLabel>
              <Input id="address-city" {...form.register('addresses.0.city')} />
            </Field>
            <Field>
              <FieldLabel htmlFor="address-postal">Postal code</FieldLabel>
              <Input id="address-postal" {...form.register('addresses.0.postalCode')} />
            </Field>
            <Field>
              <FieldLabel htmlFor="address-country">Country</FieldLabel>
              <Input id="address-country" {...form.register('addresses.0.country')} />
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
              <FieldLabel htmlFor="company-tier">Price tier</FieldLabel>
              <Select
                value={form.watch('priceTierId') ?? ''}
                onValueChange={(value) =>
                  form.setValue('priceTierId', value === '' ? null : value)
                }
              >
                <SelectTrigger id="company-tier">
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
            </Field>
            <Field>
              <FieldLabel htmlFor="company-packaging">Default packaging</FieldLabel>
              <Select
                value={form.watch('defaultPackagingTypeId') ?? ''}
                onValueChange={(value) => form.setValue('defaultPackagingTypeId', value ?? '')}
              >
                <SelectTrigger id="company-packaging">
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
            </Field>
            <Field>
              <FieldLabel htmlFor="company-driver">Default driver</FieldLabel>
              <Select
                value={form.watch('defaultDriverId') ?? ''}
                onValueChange={(value) =>
                  form.setValue('defaultDriverId', value === '' ? null : value)
                }
              >
                <SelectTrigger id="company-driver">
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
            </Field>
            {serverError !== undefined && <p className="text-body-sm text-destructive">{serverError}</p>}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              Create company
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
