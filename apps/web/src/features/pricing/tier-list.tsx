'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { priceTierSchema } from '@repo/shared';
import type { PriceTierInput } from '@repo/shared';
import { Badge } from '@repo/ui/components/ui/badge';
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
import { DataTable } from '@/components/data-table';
import { useCreateTier, useMakeDefault, usePriceTiers, useSetTierActive } from '@/hooks/use-pricing';
import type { PriceTier } from '@/hooks/use-pricing';

/**
 * Price tier list with default swap and activation.
 * Selection of the edited tier lives in the parent page.
 */
export function TierList({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  const { tiers, isLoading, isError, refetch } = usePriceTiers();
  const { makeDefault } = useMakeDefault();
  const { setActive } = useSetTierActive();
  const [creating, setCreating] = useState(false);
  const rows = tiers ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="heading-sm">Pricing tiers</h1>
        <Button size="sm" onClick={() => setCreating(true)}>
          New tier
        </Button>
      </div>
      <DataTable<PriceTier>
        columns={[
          { key: 'name', header: 'Tier', render: (row) => row.name },
          {
            key: 'default',
            header: 'Default',
            render: (row) =>
              row.isDefault ? <Badge>Default</Badge> : <span className="text-caption">—</span>,
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => (row.isActive ? 'Active' : 'Inactive'),
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => onSelect(row.id)}>
                  {selectedId === row.id ? 'Selected' : 'Open'}
                </Button>
                {!row.isDefault && (
                  <Button variant="outline" size="sm" onClick={() => makeDefault(row.id)}>
                    Make default
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActive(row.id, !row.isActive)}
                >
                  {row.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            ),
          },
        ]}
        rows={rows}
        getRowId={(row) => row.id}
        page={1}
        pageSize={rows.length === 0 ? 20 : rows.length}
        total={rows.length}
        onPageChange={() => undefined}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyTitle="No tiers yet"
        emptyDescription="Create the first tier; it becomes the default automatically."
      />
      {creating && <TierDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function TierDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { create, isPending } = useCreateTier(onClose);
  const form = useForm<PriceTierInput>({
    resolver: zodResolver(priceTierSchema),
    defaultValues: { name: '' },
  });
  const nameError = form.formState.errors.name?.message;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New price tier</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit((input) => create(input))();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="tier-name">Name</FieldLabel>
              <Input
                id="tier-name"
                placeholder="Standard"
                aria-invalid={nameError !== undefined}
                {...form.register('name')}
              />
              {nameError !== undefined && <p className="text-body-sm text-destructive">{nameError}</p>}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              Create tier
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
