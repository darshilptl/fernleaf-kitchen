'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { useCompanies } from '@/hooks/use-companies';
import type { CompanyRow } from '@/hooks/use-companies';
import { CompanyDialog } from './company-dialog';

/**
 * Company list with search and server pagination.
 * Creation opens the full company form dialog.
 */
export function CompanyTable(): React.JSX.Element {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const { data, isLoading, isError, refetch } = useCompanies(page, search);
  const rows = data?.items ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="heading-sm">Companies</h1>
          <p className="description-sm">Every customer belongs to exactly one company.</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          New company
        </Button>
      </div>
      <DataTable<CompanyRow>
        columns={[
          { key: 'name', header: 'Company', render: (row) => row.name },
          { key: 'email', header: 'Billing email', render: (row) => row.billingEmail },
          {
            key: 'tier',
            header: 'Price tier',
            render: (row) => row.priceTier?.name ?? 'Default',
          },
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
              <Link href={`/admin/companies/${row.id}`}>
                <Button variant="outline" size="sm">
                  Open
                </Button>
              </Link>
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
        emptyTitle="No companies yet"
        emptyDescription="Create the first company with its owner employee."
        filters={
          <Input
            aria-label="Search companies"
            placeholder="Search by name"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        }
      />
      {creating && <CompanyDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
