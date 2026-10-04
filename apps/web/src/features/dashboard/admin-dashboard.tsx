'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { formatMoney } from '@repo/shared';
import { useAdminFigures } from '@/hooks/use-dashboard';

/**
 * Admin operations overview. PDF §4.11, figures A1-A4 defined
 * in docs/dashboards.md. Server-computed; this page renders.
 */
export function AdminDashboard(): React.JSX.Element {
  const { figures, isLoading, isError, refetch } = useAdminFigures();

  if (isLoading || figures === undefined) {
    return (
      <div className="flex min-w-0 flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="heading-sm">Operations overview</h1>
          <p className="description-sm">Week workload, billing and menu health.</p>
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex min-w-0 flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="heading-sm">Operations overview</h1>
          <p className="description-sm">Week workload, billing and menu health.</p>
        </div>
        <p className="text-body-sm">Could not load the figures.</p>
        <Button variant="outline" size="sm" onClick={refetch}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="heading-sm">Operations overview</h1>
        <p className="description-sm">Week workload, billing and menu health.</p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Orders by status</CardTitle>
            <CardDescription>Deliveries today to today+6, all statuses.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
            {figures.byStatus.map((row) => (
              <p key={row.status} className="text-body-sm tabular-nums">
                {row.status}: {row.count} · {formatMoney(row.totalCents)}
              </p>
            ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Unbilled orders</CardTitle>
            <CardDescription>Confirmed or delivered, not yet invoiced.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
            <p className="text-body tabular-nums font-medium">{formatMoney(figures.unbilledTotalCents)}</p>
            {figures.topCompanies.map((row) => (
              <p key={row.companyId} className="text-body-sm tabular-nums">
                {row.companyName}: {row.count} · {formatMoney(row.totalCents)}
              </p>
            ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Unpaid invoices</CardTitle>
            <CardDescription>Count, total and oldest age in days.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
            <p className="text-body tabular-nums font-medium">
              {figures.unpaidCount} · {formatMoney(figures.unpaidTotalCents)}
            </p>
            <p className="text-body-sm tabular-nums">
              Oldest: {figures.oldestUnpaidAgeDays === null ? 'n/a' : `${figures.oldestUnpaidAgeDays}d`}
            </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pricing gaps</CardTitle>
            <CardDescription>Active dishes with no default-tier price.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
            <p className="text-body tabular-nums font-medium">{figures.pricingGapDishes}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
