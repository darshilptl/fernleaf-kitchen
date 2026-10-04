'use client';

import { Button } from '@repo/ui/components/ui/button';
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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Could not load data</EmptyTitle>
          <EmptyDescription>Something went wrong on the server.</EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </Empty>
    );
  }

  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
        {emptyAction}
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {filters}
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key}>{column.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={getRowId(row)} className="hover:bg-background-hover">
              {columns.map((column) => (
                <TableCell key={column.key} className="text-body-sm">
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between">
        <p className="text-caption text-foreground-muted">
          Page {page} of {pageCount} · {total} total
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
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
