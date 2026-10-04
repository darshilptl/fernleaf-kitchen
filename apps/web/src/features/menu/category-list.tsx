'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { menuCategorySchema } from '@repo/shared';
import type { MenuCategoryInput } from '@repo/shared';
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
import {
  useCreateCategory,
  useDeleteCategory,
  useMenuCategories,
  useReorderCategories,
  useSetCategoryActive,
  useUpdateCategory,
} from '@/hooks/use-menu';

/**
 * Menu categories with reorder, secret flags, and hard delete.
 * Dish placements are managed inside the menu preview screen's
 * sibling manager below.
 */
export function CategoryList(): React.JSX.Element {
  const { categories, isLoading, isError, refetch } = useMenuCategories();
  const { reorder } = useReorderCategories();
  const { remove } = useDeleteCategory();
  const { setActive } = useSetCategoryActive();
  const [editing, setEditing] = useState<MenuCategoryInput & { id: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [toggling, setToggling] = useState<{ id: string; name: string; active: boolean } | null>(
    null,
  );
  const rows = categories ?? [];

  function move(index: number, direction: -1 | 1): void {
    const ids = rows.map((row) => row.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) {
      return;
    }
    const moving = ids[index];
    const other = ids[target];
    if (moving === undefined || other === undefined) {
      return;
    }
    ids[index] = other;
    ids[target] = moving;
    reorder(ids);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="heading-sm">Menu</h1>
          <p className="description-sm">Categories and dish placements, in serving order.</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          New category
        </Button>
      </div>
      <DataTable<(typeof rows)[number]>
        columns={[
          { key: 'name', header: 'Category', render: (row) => row.name },
          { key: 'slug', header: 'Slug', render: (row) => row.slug },
          {
            key: 'flags',
            header: 'Flags',
            render: (row) => (
              <span className="text-caption">
                {row.isSecret ? <Badge>Secret</Badge> : <Badge>Listed</Badge>}
              </span>
            ),
          },
          {
            key: 'items',
            header: 'Placements',
            render: (row) => <span className="tabular-nums">{row._count.items}</span>,
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => {
              const index = rows.findIndex((entry) => entry.id === row.id);
              return (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    document
                      .getElementById(`placements-${row.id}`)
                      ?.scrollIntoView({ behavior: 'smooth' })
                  }
                >
                  Placements
                </Button>
                <Button variant="outline" size="sm" onClick={() => move(index, -1)}>
                  Up
                </Button>
                <Button variant="outline" size="sm" onClick={() => move(index, 1)}>
                  Down
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditing({
                      id: row.id,
                      name: row.name,
                      slug: row.slug,
                      description: row.description,
                      sortOrder: row.sortOrder,
                      isSecret: row.isSecret,
                    })
                  }
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    row.isActive
                      ? setToggling({ id: row.id, name: row.name, active: false })
                      : setActive(row.id, true)
                  }
                >
                  {row.isActive ? 'Hide' : 'Show'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleting({ id: row.id, name: row.name })}
                >
                  Delete
                </Button>
              </div>
              );
            },
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
        emptyTitle="No categories yet"
        emptyDescription="Create categories, then place dishes in them."
      />
      {creating && <CategoryDialog onClose={() => setCreating(false)} />}
      {editing !== null && (
        <CategoryDialog
          category={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {toggling !== null && (
        <AlertDialog open onOpenChange={() => setToggling(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hide {toggling.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Its dishes disappear from every employee menu until shown again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setActive(toggling.id, toggling.active);
                  setToggling(null);
                }}
              >
                Hide
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {deleting !== null && (
        <AlertDialog open onOpenChange={() => setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {deleting.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Placements are removed with the category. Dishes themselves stay.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  remove(deleting.id);
                  setDeleting(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

function CategoryDialog({
  category,
  onClose,
}: {
  category?: MenuCategoryInput & { id: string };
  onClose: () => void;
}): React.JSX.Element {
  const { create, isPending: creating } = useCreateCategory(onClose);
  const { update, isPending: updating } = useUpdateCategory(onClose);
  const form = useForm<MenuCategoryInput>({
    resolver: zodResolver(menuCategorySchema),
    defaultValues: {
      name: category?.name ?? '',
      slug: category?.slug ?? null,
      description: category?.description ?? null,
      sortOrder: category?.sortOrder ?? 0,
      isSecret: category?.isSecret ?? false,
    },
  });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category === undefined ? 'New category' : 'Edit category'}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit((input) => {
              if (category === undefined) {
                create(input);
              } else {
                update(category.id, input);
              }
            })();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="category-name">Name</FieldLabel>
              <Input id="category-name" {...form.register('name')} />
            </Field>
            <Field>
              <FieldLabel htmlFor="category-slug">Slug (blank = from name)</FieldLabel>
              <Input
                id="category-slug"
                {...form.register('slug', {
                  setValueAs: (value: unknown) => (value === '' ? null : value),
                })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="category-description">Description</FieldLabel>
              <Input id="category-description" {...form.register('description')} />
            </Field>
            <Field>
              <label className="flex items-center gap-2 text-body-sm">
                <Checkbox
                  checked={form.watch('isSecret') ?? false}
                  onCheckedChange={(checked) => form.setValue('isSecret', checked === true)}
                />
                Secret category (unlisted, reachable by slug)
              </label>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating || updating}>
              Save category
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
