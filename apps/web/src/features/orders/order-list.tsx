'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@repo/ui/components/ui/drawer';
import { formatMoney } from '@repo/shared';
import { DataTable } from '@/components/data-table';
import { DatePicker } from '@/components/date-picker';
import { StatusBadge } from '@/components/status-badge';
import type { StatusTone } from '@/components/status-badge';
import { useCompanies } from '@/hooks/use-companies';
import { useOrders, useRunCutoff } from '@/hooks/use-orders';
import type { OrderRow, OrderStatus } from '@/hooks/use-orders';
import { OrderBuilder } from './order-builder';

const STATUS_TONE: Record<OrderStatus, StatusTone> = {
  DRAFT: 'ghost',
  PLACED: 'warning',
  CONFIRMED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'ghost',
  REJECTED: 'destructive',
};

const STATUSES: OrderStatus[] = ['DRAFT', 'PLACED', 'CONFIRMED', 'DELIVERED', 'CANCELLED', 'REJECTED'];

/**
 * Order list: searchable, filterable, paginated (PDF §4.6).
 * Filters mirror the endpoint; the cut-off button triggers
 * processing manually so reviewers never wait a minute.
 */
export function OrderList(): React.JSX.Element {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [companyId, setCompanyId] = useState('');
  const [invoiced, setInvoiced] = useState<'' | 'yes' | 'no'>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [creating, setCreating] = useState(false);
  const { data, isLoading, isError, refetch } = useOrders({
    page,
    search,
    status: status === '' ? undefined : status,
    companyId: companyId === '' ? undefined : companyId,
    invoiced: invoiced === '' ? undefined : invoiced === 'yes',
    from: from === '' ? undefined : from,
    to: to === '' ? undefined : to,
  });
  const { data: companies } = useCompanies(1, '');
  const { run, isPending: running } = useRunCutoff();
  const rows = data?.items ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="heading-sm">Orders</h1>
          <p className="description-sm">Drafts, placed and confirmed orders with totals.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={run} disabled={running}>
            Run cut-off
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            New order
          </Button>
        </div>
      </div>
      <DataTable<OrderRow>
        columns={[
          {
            key: 'number',
            header: 'Order',
            render: (row) => (
              <Link className="tabular-nums text-body-sm" href={`/admin/orders/${row.id}`}>
                #{row.orderNumber}
              </Link>
            ),
          },
          {
            key: 'employee',
            header: 'Employee',
            render: (row) => <span className="text-body-sm">{row.employee.name}</span>,
          },
          {
            key: 'company',
            header: 'Company',
            render: (row) => <span className="text-body-sm">{row.company.name}</span>,
          },
          {
            key: 'delivery',
            header: 'Delivery',
            render: (row) => <span className="tabular-nums text-body-sm">{row.deliveryDate}</span>,
          },
          {
            key: 'total',
            header: 'Total',
            render: (row) => (
              <span className="tabular-nums text-body-sm">{formatMoney(row.totalCents)}</span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusBadge tone={STATUS_TONE[row.status]} label={row.status} />,
          },
        ]}
        rows={rows}
        getRowId={(row) => row.id}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 20}
        total={data?.total ?? 0}
        onPageChange={setPage}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyTitle="No orders yet"
        emptyDescription="Create an order for an employee to get started."
        filters={
          <div className="flex flex-wrap items-center gap-4">
            <Input
              aria-label="Search orders"
              placeholder="Order #, employee, company"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="w-56"
            />
            <Select
              value={status === '' ? 'all' : status}
              onValueChange={(value) => {
                setStatus(value === null || value === 'all' ? '' : (value as OrderStatus));
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Status filter" className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
<SelectGroup>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectGroup>
</SelectContent>
            </Select>
            <Select
              value={companyId === '' ? 'all' : companyId}
              onValueChange={(value) => {
                setCompanyId(value === null || value === 'all' ? '' : value);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Company filter" className="w-44">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
<SelectGroup>
                <SelectItem value="all">All companies</SelectItem>
                {(companies?.items ?? []).map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectGroup>
</SelectContent>
            </Select>
            <Select
              value={invoiced === '' ? 'all' : invoiced}
              onValueChange={(value) => {
                setInvoiced(value === null || value === 'all' ? '' : (value as 'yes' | 'no'));
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Invoiced filter" className="w-36">
                <SelectValue placeholder="Invoiced" />
              </SelectTrigger>
              <SelectContent>
<SelectGroup>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Invoiced</SelectItem>
                <SelectItem value="no">Not invoiced</SelectItem>
              </SelectGroup>
</SelectContent>
            </Select>
            <DatePicker
              value={from}
              onChange={(value) => {
                setFrom(value);
                setPage(1);
              }}
              label="From date"
            />
            <DatePicker
              value={to}
              onChange={(value) => {
                setTo(value);
                setPage(1);
              }}
              label="To date"
            />
          </div>
        }
      />
      <Drawer open={creating} onOpenChange={setCreating} swipeDirection="right">
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>New order</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <OrderBuilder onDone={() => setCreating(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
