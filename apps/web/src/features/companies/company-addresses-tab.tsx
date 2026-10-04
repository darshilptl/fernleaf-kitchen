'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addressSchema } from '@repo/shared';
import type { AddressInput } from '@repo/shared';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@repo/ui/components/ui/field';
import { Input } from '@repo/ui/components/ui/input';
import {
  useAddAddress,
  useAddDomain,
  useCompany,
  useMakeDefaultAddress,
  useRemoveDomain,
} from '@/hooks/use-companies';

/**
 * Company addresses and email domains. Exactly one active
 * default address; at least one domain. Server enforces both.
 */
export function CompanyAddressesTab({ companyId }: { companyId: string }): React.JSX.Element {
  const { company } = useCompany(companyId);
  const { add: addAddress, isPending: addingAddress } = useAddAddress(companyId);
  const { makeDefault } = useMakeDefaultAddress(companyId);
  const { add: addDomain, isPending: addingDomain } = useAddDomain(companyId);
  const { remove: removeDomain } = useRemoveDomain(companyId);
  const [showAddress, setShowAddress] = useState(false);
  const [domain, setDomain] = useState('');

  if (company === undefined) {
    return <p className="text-body-sm">Loading company…</p>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="heading-sm">Addresses</h2>
          <Button size="sm" onClick={() => setShowAddress((open) => !open)}>
            {showAddress ? 'Close' : 'Add address'}
          </Button>
        </div>
        {company.addresses.map((address) => (
          <div
            key={address.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-background-panel p-6 shadow-card"
          >
            <div className="flex flex-col gap-1">
              <p className="text-body-sm font-medium">
                {address.label} {address.isDefault && <Badge>Default</Badge>}
              </p>
              <p className="text-caption text-foreground-muted">
                {address.line1}, {address.city} {address.postalCode}, {address.country}
              </p>
            </div>
            {!address.isDefault && address.isActive && (
              <Button variant="outline" size="sm" onClick={() => makeDefault(address.id)}>
                Make default
              </Button>
            )}
          </div>
        ))}
        {showAddress && <AddressForm companyId={companyId} />}
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <h2 className="heading-sm">Email domains</h2>
        {company.domains.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-body-sm">{row.domain}</p>
            <Button variant="outline" size="sm" onClick={() => removeDomain(row.id)}>
              Remove
            </Button>
          </div>
        ))}
        <form
          className="flex flex-wrap items-center gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (domain.trim() !== '') {
              addDomain(domain);
              setDomain('');
            }
          }}
        >
          <Input
            aria-label="New domain"
            placeholder="acme.in"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
          />
          <Button type="submit" size="sm" disabled={addingDomain}>
            Add
          </Button>
        </form>
      </div>
    </div>
  );
}

function AddressForm({ companyId }: { companyId: string }): React.JSX.Element {
  const { add, isPending } = useAddAddress(companyId);
  const form = useForm<AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: { label: '', line1: '', city: '', postalCode: '', country: '' },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit((input) => add(input))();
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="address-label">Label</FieldLabel>
          <Input id="address-label" {...form.register('label')} />
        </Field>
        <Field>
          <FieldLabel htmlFor="address-line1">Line 1</FieldLabel>
          <Input id="address-line1" {...form.register('line1')} />
        </Field>
        <Field>
          <FieldLabel htmlFor="address-city">City</FieldLabel>
          <Input id="address-city" {...form.register('city')} />
        </Field>
        <Field>
          <FieldLabel htmlFor="address-postal">Postal code</FieldLabel>
          <Input id="address-postal" {...form.register('postalCode')} />
        </Field>
        <Field>
          <FieldLabel htmlFor="address-country">Country</FieldLabel>
          <Input id="address-country" {...form.register('country')} />
        </Field>
        <div>
          <Button type="submit" size="sm" disabled={isPending}>
            Save address
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
