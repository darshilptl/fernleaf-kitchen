'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changeRoleSchema, createStaffSchema } from '@repo/shared';
import type { ChangeRoleInput, CreateStaffInput } from '@repo/shared';
import { Button } from '@repo/ui/components/ui/button';
import { DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';

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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@repo/ui/components/ui/alert-dialog';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { useSetStaffActive, useStaff } from '@/hooks/use-staff';
import type { StaffRow } from '@/hooks/use-staff';
import { StaffDialog } from './staff-dialog';

/**
 * Staff table with create / change-role dialog and
 * activate/deactivate confirms. Self-deactivation fails on the
 * server and surfaces as a toast.
 */
export function StaffTable(): React.JSX.Element {
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [changing, setChanging] = useState<StaffRow | null>(null);
  const [confirming, setConfirming] = useState<{ row: StaffRow; active: boolean } | null>(null);
  const { data, isLoading, isError, refetch } = useStaff(page);
  const { setActive } = useSetStaffActive();
  const rows = data?.items ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="heading-sm">Staff</h1>
          <p className="description-sm">One account, one role. Deactivation applies immediately.</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          New account
        </Button>
      </div>
      <DataTable<StaffRow>
        columns={[
          { key: 'name', header: 'Name', render: (row) => row.name },
          { key: 'email', header: 'Email', render: (row) => row.email },
          { key: 'role', header: 'Role', render: (row) => row.roleName },
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
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" size="sm">Actions</Button>}
                />
                <DropdownMenuContent>
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => setChanging(row)}>
                      Change role
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setConfirming({ row, active: !row.isActive })}>
                      {row.isActive ? 'Deactivate' : 'Activate'}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
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
        emptyTitle="No staff accounts"
        emptyDescription="Create the first staff account."
      />
      {creating && <StaffDialog onClose={() => setCreating(false)} />}
      {changing !== null && (
        <StaffDialog row={changing} onClose={() => setChanging(null)} />
      )}
      {confirming !== null && (
        <AlertDialog open onOpenChange={() => setConfirming(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirming.active ? 'Activate' : 'Deactivate'} {confirming.row.name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirming.active
                  ? 'The account can sign in again immediately.'
                  : 'The account loses access immediately. Deactivating yourself is blocked.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setActive(confirming.row.id, confirming.active);
                  setConfirming(null);
                }}
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
