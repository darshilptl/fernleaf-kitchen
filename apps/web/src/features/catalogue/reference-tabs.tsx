'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { referenceItemSchema } from '@repo/shared';
import type { ReferenceItemInput } from '@repo/shared';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { ApiError } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/apply-server-errors';
import {
  REFERENCE_LISTS,
  useCreateReference,
  useReferenceList,
  useSetReferenceActive,
  useUpdateReference,
} from '@/hooks/use-catalogue';
import type { ReferenceListKey, ReferenceRow } from '@/hooks/use-catalogue';

/**
 * Admin reference lists: allergens, dietary tags, stations,
 * portion sizes, packaging. Create, rename, deactivate and
 * reactivate inline per list.
 */
export function ReferenceTabs(): React.JSX.Element {
  const [tab, setTab] = useState<ReferenceListKey>('allergens');
  return (
    <div className="flex flex-col gap-4">
      <h2 className="heading-sm">Reference lists</h2>
      <Tabs value={tab} onValueChange={(value) => setTab(value as ReferenceListKey)}>
        <TabsList>
          {REFERENCE_LISTS.map((list) => (
            <TabsTrigger key={list.key} value={list.key}>
              {list.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {REFERENCE_LISTS.map((list) => (
          <TabsContent key={list.key} value={list.key}>
            <ReferenceListManager listKey={list.key} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ReferenceListManager({ listKey }: { listKey: ReferenceListKey }): React.JSX.Element {
  const { rows, isLoading } = useReferenceList(listKey);
  const { setActive } = useSetReferenceActive(listKey);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<ReferenceRow | null>(null);
  const list = rows ?? [];

  if (isLoading) {
    return <p className="text-body-sm">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}>
          New entry
        </Button>
      </div>
      {list.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-4">
          <p className="text-body-sm">
            {row.name} {!row.isActive && <Badge>Inactive</Badge>}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setRenaming(row)}>
              Rename
            </Button>
            <Button variant="outline" size="sm" onClick={() => setActive(row.id, !row.isActive)}>
              {row.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        </div>
      ))}
      {list.length === 0 && (
        <p className="description-sm">No entries yet. Create the first one.</p>
      )}
      {creating && (
        <ReferenceDialog listKey={listKey} onClose={() => setCreating(false)} />
      )}
      {renaming !== null && (
        <ReferenceDialog listKey={listKey} row={renaming} onClose={() => setRenaming(null)} />
      )}
    </div>
  );
}

function ReferenceDialog({
  listKey,
  row,
  onClose,
}: {
  listKey: ReferenceListKey;
  row?: ReferenceRow;
  onClose: () => void;
}): React.JSX.Element {
  const { create, isPending: creating } = useCreateReference(listKey, onClose);
  const { update, isPending: updating } = useUpdateReference(listKey, onClose);
  const form = useForm<ReferenceItemInput>({
    resolver: zodResolver(referenceItemSchema),
    defaultValues: { name: row?.name ?? '', sortOrder: row?.sortOrder ?? 0 },
  });
  const serverError = form.formState.errors.root?.server?.message;

  function handleSubmit(input: ReferenceItemInput): void {
    try {
      if (row === undefined) {
        create(input);
      } else {
        update(row.id, input);
      }
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
          <DialogTitle>{row === undefined ? 'New entry' : `Rename ${row.name}`}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit(handleSubmit)();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="reference-name">Name</FieldLabel>
              <Input id="reference-name" {...form.register('name')} />
            </Field>
            {serverError !== undefined && <p className="text-destructive">{serverError}</p>}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating || updating}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
