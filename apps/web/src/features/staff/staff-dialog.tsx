'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changeRoleSchema, createStaffSchema } from '@repo/shared';
import type { ChangeRoleInput, CreateStaffInput } from '@repo/shared';
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
import { useChangeRole, useCreateStaff, useRoles } from '@/hooks/use-staff';
import type { StaffRow } from '@/hooks/use-staff';

/**
 * Staff create / change-role dialog. Creation takes name, email,
 * role and a temporary password; role change takes only the role.
 * Server errors map onto fields; anything else is a toast.
 */
export function StaffDialog({
  row,
  onClose,
}: {
  row?: StaffRow;
  onClose: () => void;
}): React.JSX.Element {
  const { roles } = useRoles();
  const { create, isPending: creating } = useCreateStaff(onClose);
  const { change, isPending: changing } = useChangeRole(onClose);
  const isEdit = row !== undefined;
  const form = useForm<CreateStaffInput>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: { name: '', email: '', roleId: '', password: '' },
  });
  const roleForm = useForm<ChangeRoleInput>({
    resolver: zodResolver(changeRoleSchema),
    defaultValues: { roleId: row?.roleId ?? '' },
  });
  const serverError = form.formState.errors.root?.server?.message;

  function handleCreate(input: CreateStaffInput): void {
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? `Change role: ${row.name}` : 'New staff account'}</DialogTitle>
        </DialogHeader>
        {isEdit && row !== undefined ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void roleForm.handleSubmit((input) => change(row.id, input))();
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="staff-role-change">Role</FieldLabel>
                <Select
                  value={roleForm.watch('roleId')}
                  onValueChange={(value) => {
                    if (value !== null) {
                      roleForm.setValue('roleId', value);
                    }
                  }}
                >
                  <SelectTrigger id="staff-role-change">
                    <SelectValue placeholder="Pick a role" />
                  </SelectTrigger>
                  <SelectContent>
<SelectGroup>
                    {(roles ?? []).map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
</SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={changing}>
                Change role
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit(handleCreate)();
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="staff-name">Name</FieldLabel>
                <Input id="staff-name" {...form.register('name')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="staff-email">Email</FieldLabel>
                <Input id="staff-email" type="email" {...form.register('email')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="staff-role">Role</FieldLabel>
                <Select
                  value={form.watch('roleId')}
                  onValueChange={(value) => {
                    if (value !== null) {
                      form.setValue('roleId', value);
                    }
                  }}
                >
                  <SelectTrigger id="staff-role">
                    <SelectValue placeholder="Pick a role" />
                  </SelectTrigger>
                  <SelectContent>
<SelectGroup>
                    {(roles ?? []).map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
</SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="staff-password">Temporary password</FieldLabel>
                <Input
                  id="staff-password"
                  type="password"
                  autoComplete="new-password"
                  {...form.register('password')}
                />
              </Field>
              {serverError !== undefined && <p className="text-body-sm text-destructive">{serverError}</p>}
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                Create account
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
