'use client';

import { useState } from 'react';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
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
import {
  useCreateEmployee,
  useEmployees,
  useSetEmployeeActive,
  useUpdateEmployee,
} from '@/hooks/use-employees';
import type { EmployeeRow } from '@/hooks/use-employees';
import { createEmployeeSchema } from '@repo/shared';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateEmployeeInput } from '@repo/shared';
import { CsvImportDialog } from './csv-import-dialog';

/**
 * Employees of one company: table with create/edit/deactivate.
 * Flags, allergies, and dietary preferences per PDF §4.5.
 */
export function EmployeeTable({ companyId }: { companyId: string }): React.JSX.Element {
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [importing, setImporting] = useState(false);
  const { data, isLoading, isError, refetch } = useEmployees(companyId, page);
  const { setActive } = useSetEmployeeActive();
  const rows = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="heading-sm">Employees</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImporting(true)}>
            Import CSV
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            Add employee
          </Button>
        </div>
      </div>
      <DataTable<EmployeeRow>
        columns={[
          { key: 'name', header: 'Name', render: (row) => row.name },
          { key: 'email', header: 'Email', render: (row) => row.email },
          {
            key: 'status',
            header: 'Status',
            render: (row) => (row.isActive ? <Badge>Active</Badge> : <Badge>Inactive</Badge>),
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(row)}>
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => setActive(row.id, !row.isActive)}>
                  {row.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
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
        emptyTitle="No employees yet"
        emptyDescription="Add employees or import them from CSV."
      />
      {creating && <EmployeeDialog companyId={companyId} onClose={() => setCreating(false)} />}
      {editing !== null && (
        <EmployeeDialog
          companyId={companyId}
          employee={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {importing && <CsvImportDialog companyId={companyId} onClose={() => setImporting(false)} />}
    </div>
  );
}

function EmployeeDialog({
  companyId,
  employee,
  onClose,
}: {
  companyId: string;
  employee?: EmployeeRow;
  onClose: () => void;
}): React.JSX.Element {
  const { create, isPending: creating } = useCreateEmployee(companyId, onClose);
  const { update, isPending: updating } = useUpdateEmployee(onClose);
  const isEdit = employee !== undefined;
  const form = useForm<CreateEmployeeInput>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      name: employee?.name ?? '',
      email: employee?.email ?? '',
      canChooseAddress: employee?.canChooseAddress ?? false,
      canChangeDeliveryTime: employee?.canChangeDeliveryTime ?? false,
      canChangePackaging: employee?.canChangePackaging ?? false,
    },
  });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit employee' : 'Add employee'}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit((input) => {
              if (isEdit && employee !== undefined) {
                update(employee.id, input);
              } else {
                create(input);
              }
            })();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="employee-name">Name</FieldLabel>
              <Input id="employee-name" {...form.register('name')} />
            </Field>
            {!isEdit && (
              <Field>
                <FieldLabel htmlFor="employee-email">Email</FieldLabel>
                <Input id="employee-email" type="email" {...form.register('email')} />
              </Field>
            )}
            <Field>
              <label className="flex items-center gap-2 text-body-sm">
                <Checkbox
                  checked={form.watch('canChooseAddress') ?? false}
                  onCheckedChange={(checked) => form.setValue('canChooseAddress', checked === true)}
                />
                Can choose delivery address
              </label>
            </Field>
            <Field>
              <label className="flex items-center gap-2 text-body-sm">
                <Checkbox
                  checked={form.watch('canChangeDeliveryTime') ?? false}
                  onCheckedChange={(checked) =>
                    form.setValue('canChangeDeliveryTime', checked === true)
                  }
                />
                Can change delivery time
              </label>
            </Field>
            <Field>
              <label className="flex items-center gap-2 text-body-sm">
                <Checkbox
                  checked={form.watch('canChangePackaging') ?? false}
                  onCheckedChange={(checked) => form.setValue('canChangePackaging', checked === true)}
                />
                Can change packaging
              </label>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating || updating}>
              Save employee
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
