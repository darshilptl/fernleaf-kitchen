'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@repo/ui/components/ui/empty';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { formatMoney } from '@repo/shared';
import { DataTable } from '@/components/data-table';
import { useBillable, useCreateInvoice, useInvoices } from '@/hooks/use-billing';
import { useCompanies } from '@/hooks/use-companies';

/**
 * Billing workspace: per-company billable orders with selection
 * into an invoice, plus the invoice list (PDF §4.9). Paid and
 * unpaid invoices stay distinguishable by word and tone.
 */
export function BillableList(): React.JSX.Element {
  const router = useRouter();
  const [companyId, setCompanyId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const { data: companies } = useCompanies(1, '');
  const { orders, isLoading, isError, refetch } = useBillable(companyId);
  const { data: invoices, isLoading: invoicesLoading } = useInvoices(page, companyId);
  const { create, isPending: creating } = useCreateInvoice((id) => {
    setSelected([]);
    router.push(`/admin/billing/${id}`);
  });

  function toggle(id: string): void {
    setSelected((prev) => (prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id]));
  }

  const selectedTotal = orders
    .filter((row) => selected.includes(row.id))
    .reduce((sum, row) => sum + row.totalCents, 0);

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="heading-sm">Billing</h1>
          <p className="description-sm">Billable orders per company, grouped into invoices.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Select
          value={companyId === '' ? 'all' : companyId}
          onValueChange={(value) => {
            const next = value === null || value === 'all' ? '' : value;
            setCompanyId(next);
            setSelected([]);
            setPage(1);
          }}
        >
          <SelectTrigger aria-label="Company" className="w-64">
            <SelectValue placeholder="Select a company" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Select a company</SelectItem>
            {(companies?.items ?? []).map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected.length > 0 && (
          <Button
            size="sm"
            disabled={creating}
            onClick={() => create(companyId, selected)}
          >
            Create invoice · {formatMoney(selectedTotal)} · {selected.length} order
            {selected.length === 1 ? '' : 's'}
          </Button>
        )}
      </div>
      <div className="bg-background-panel rounded-lg shadow-card p-6">
        {companyId === '' ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Select a company</EmptyTitle>
              <EmptyDescription>Billable orders for the company appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : isLoading ? (
          <div className="flex min-w-0 flex-col gap-6">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-5 w-full" />
            ))}
          </div>
        ) : isError ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Could not load billable orders</EmptyTitle>
              <EmptyDescription>Something went wrong on the server.</EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
          </Empty>
        ) : orders.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No billable orders</EmptyTitle>
              <EmptyDescription>Every confirmed order for this company is invoiced.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <DataTable
            columns={[
              {
                key: 'select',
                header: '',
                render: (row) => (
                  <Checkbox
                    aria-label={`Select order ${row.orderNumber}`}
                    checked={selected.includes(row.id)}
                    onCheckedChange={() => toggle(row.id)}
                  />
                ),
              },
              {
                key: 'order',
                header: 'Order',
                render: (row) => <span className="tabular-nums">#{row.orderNumber}</span>,
              },
              {
                key: 'date',
                header: 'Delivery',
                render: (row) => <span className="tabular-nums">{row.deliveryDate}</span>,
              },
              {
                key: 'employee',
                header: 'Employee',
                render: (row) => row.employee.name,
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => row.status,
              },
              {
                key: 'total',
                header: 'Total',
                render: (row) => <span className="tabular-nums">{formatMoney(row.totalCents)}</span>,
              },
            ]}
            rows={orders}
            getRowId={(row) => row.id}
            page={1}
            pageSize={orders.length}
            total={orders.length}
            onPageChange={() => undefined}
            isLoading={false}
            isError={false}
            onRetry={() => undefined}
            emptyTitle="No billable orders"
            emptyDescription="Every confirmed order for this company is invoiced."
          />
        )}
      </div>
      <div className="bg-background-panel rounded-lg shadow-card p-6">
        <h2 className="heading-sm mb-6">Invoices</h2>
        <DataTable
          columns={[
            {
              key: 'invoice',
              header: 'Invoice',
              render: (row) => <span className="tabular-nums">#{row.invoiceNumber}</span>,
            },
            {
              key: 'company',
              header: 'Company',
              render: (row) => row.company.name,
            },
            {
              key: 'orders',
              header: 'Orders',
              render: (row) => <span className="tabular-nums">{row._count.orders}</span>,
            },
            {
              key: 'total',
              header: 'Total',
              render: (row) => <span className="tabular-nums">{formatMoney(row.totalCents)}</span>,
            },
            {
              key: 'paid',
              header: 'Paid',
              render: (row) => (row.paidAt === null ? 'Unpaid' : 'Paid'),
            },
            {
              key: 'open',
              header: '',
              render: (row) => (
                <Button variant="outline" size="sm" onClick={() => router.push(`/admin/billing/${row.id}`)}>
                  Open
                </Button>
              ),
            },
          ]}
          rows={invoices?.items ?? []}
          getRowId={(row) => row.id}
          page={invoices?.page ?? 1}
          pageSize={invoices?.pageSize ?? 20}
          total={invoices?.total ?? 0}
          onPageChange={setPage}
          isLoading={invoicesLoading}
          isError={false}
          onRetry={() => undefined}
          emptyTitle="No invoices"
          emptyDescription="Invoices for this company appear here."
        />
      </div>
    </div>
  );
}
