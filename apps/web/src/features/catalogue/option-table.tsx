'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { optionSchema, parseMoney } from '@repo/shared';
import type { OptionInput } from '@repo/shared';
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
import { StatusBadge } from '@/components/status-badge';
import { ApiError } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/apply-server-errors';
import { useCreateOption, useOptions, useSetOptionActive } from '@/hooks/use-catalogue';
import type { OptionRow } from '@/hooks/use-catalogue';

type OptionFormValues = Omit<OptionInput, 'costCents'>;

/**
 * Reusable options with costs. Money flows as dollars strings
 * through shared parse/format helpers.
 */
export function OptionTable(): React.JSX.Element {
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const { data, isLoading, isError, refetch } = useOptions(page);
  const { setActive } = useSetOptionActive();
  const rows = data?.items ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="heading-sm">Options</h2>
        <Button size="sm" onClick={() => setCreating(true)}>
          New option
        </Button>
      </div>
      <DataTable<OptionRow>
        columns={[
          { key: 'name', header: 'Option', render: (row) => row.name },
          {
            key: 'status',
            header: 'Status',
            render: (row) =>
              row.isActive ? (
                <StatusBadge tone="success" label="Active" />
              ) : (
                <StatusBadge tone="ghost" label="Inactive" />
              ),
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <Button variant="outline" size="sm" onClick={() => setActive(row.id, !row.isActive)}>
                {row.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            ),
          },
        ]}
        rows={rows}
        getRowId={(row) => row.id}
        page={data?.page ?? page}
        pageSize={data?.pageSize ?? 20}
        total={data?.total ?? 0}
        onPageChange={setPage}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyTitle="No options yet"
        emptyDescription="Options are reusable choices attached to dish groups."
      />
      {creating && <OptionDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function OptionDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { create, isPending } = useCreateOption(onClose);
  const [costText, setCostText] = useState('');
  const form = useForm<OptionFormValues>({
    resolver: zodResolver(optionSchema.omit({ costCents: true })),
    defaultValues: { name: '', description: null, allergenIds: [], dietaryTagIds: [] },
  });
  const serverError = form.formState.errors.root?.server?.message;

  function handleSubmit(values: OptionFormValues): void {
    let costCents: number;
    try {
      costCents = parseMoney(costText);
    } catch {
      form.setError('root.server', { type: 'server', message: 'Cost must look like 7.45' });
      return;
    }
    try {
      create({ ...values, costCents });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        applyServerErrors(form, error);
      }
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New option</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit(handleSubmit)();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="option-name">Name</FieldLabel>
              <Input id="option-name" {...form.register('name')} />
            </Field>
            <Field>
              <FieldLabel htmlFor="option-cost">Cost price ($)</FieldLabel>
              <Input
                id="option-cost"
                placeholder="7.45"
                value={costText}
                onChange={(event) => setCostText(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="option-description">Description</FieldLabel>
              <Input id="option-description" {...form.register('description')} />
            </Field>
            {serverError !== undefined && <p className="text-body-sm text-destructive">{serverError}</p>}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              Create option
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
