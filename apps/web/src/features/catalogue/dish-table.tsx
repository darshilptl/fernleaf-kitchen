'use client';

import { useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';

import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { useDishes, useSetDishActive } from '@/hooks/use-catalogue';
import type { DishRow } from '@/hooks/use-catalogue';
import { DishSheet } from './dish-sheet';

/**
 * Dish list with a Sheet form for create/edit, groups, options,
 * and activation. Money flows as dollars strings through shared
 * parse/format helpers.
 */
export function DishTable(): React.JSX.Element {
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DishRow | null>(null);
  const { data, isLoading, isError, refetch } = useDishes(page);
  const { setActive } = useSetDishActive();
  const rows = data?.items ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="heading-sm">Catalogue</h1>
          <p className="description-sm">Dishes are deactivated, never deleted.</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          New dish
        </Button>
      </div>
      <DataTable<DishRow>
        columns={[
          { key: 'name', header: 'Dish', render: (row) => row.name },
          { key: 'sku', header: 'SKU', render: (row) => row.sku },
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
                    <DropdownMenuItem onClick={() => setEditing(row)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActive(row.id, !row.isActive)}>
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
        emptyTitle="No dishes yet"
        emptyDescription="Create the first dish to start the catalogue."
      />
      {creating && <DishSheet onClose={() => setCreating(false)} />}
      {editing !== null && <DishSheet dish={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
