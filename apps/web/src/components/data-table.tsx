'use client';

import { useState } from 'react';
import { GripVertical } from 'lucide-react';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@repo/ui/components/ui/empty';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: ReadonlyArray<DataTableColumn<T>>;
  rows: readonly T[];
  getRowId: (row: T) => string;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: React.ReactNode;
  filters?: React.ReactNode;
}

/**
 * Shared server-paginated table. Dense rows, hover state, pager,
 * and loading/empty/error states per the frontend contract.
 * Pages supply columns, filters, and the empty-state action.
 * Leading grip + checkbox columns mirror the reference table
 * chrome; selection is local visual state (highlight only).
 */
export function DataTable<T>(props: DataTableProps<T>): React.JSX.Element {
  const {
    columns,
    rows,
    getRowId,
    page,
    pageSize,
    total,
    onPageChange,
    isLoading,
    isError,
    onRetry,
    emptyTitle,
    emptyDescription,
    emptyAction,
    filters,
  } = props;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const pageIds = rows.map((row) => getRowId(row));
  const allChecked = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll(): void {
    setSelected(allChecked ? new Set() : new Set(pageIds));
  }

  function headerRow(): React.JSX.Element {
    return (
      <TableRow>
        <TableHead className="w-8" aria-label="Reorder handle" />
        <TableHead className="w-10">
          <Checkbox
            aria-label="Select all rows"
            checked={allChecked}
            onCheckedChange={() => toggleAll()}
          />
        </TableHead>
        {columns.map((column) => (
          <TableHead key={column.key} className="bg-background">
            {column.header}
          </TableHead>
        ))}
      </TableRow>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        {filters}
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">{headerRow()}</TableHeader>
            <TableBody>
              {[0, 1, 2].map((index) => (
                <TableRow key={index}>
                  <TableCell colSpan={columns.length + 2}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        {filters}
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Could not load data</EmptyTitle>
            <EmptyDescription>Something went wrong on the server.</EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </Empty>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        {filters}
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            <EmptyDescription>{emptyDescription}</EmptyDescription>
          </EmptyHeader>
          {emptyAction}
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {filters}
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">{headerRow()}</TableHeader>
          <TableBody>
            {rows.map((row) => {
              const id = getRowId(row);
              return (
                <TableRow
                  key={id}
                  className="hover:bg-background-hover data-[selected=true]:bg-brand-muted"
                  data-selected={selected.has(id)}
                >
                  <TableCell className="w-8">
                    <GripVertical
                      aria-hidden="true"
                      className="text-foreground-ghost"
                    />
                  </TableCell>
                  <TableCell className="w-10">
                    <Checkbox
                      aria-label={`Select row ${id}`}
                      checked={selected.has(id)}
                      onCheckedChange={() => toggle(id)}
                    />
                  </TableCell>
                  {columns.map((column) => (
                    <TableCell key={column.key} className="text-body-sm">
                      {column.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-caption tabular-nums text-foreground-muted">
          Page {page} of {pageCount} · {total} total
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
