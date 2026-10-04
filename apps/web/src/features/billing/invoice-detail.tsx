'use client';

import { Button } from '@repo/ui/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@repo/ui/components/ui/alert-dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@repo/ui/components/ui/empty';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { formatMoney } from '@repo/shared';
import { StatusBadge } from '@/components/status-badge';
import { useInvoice, usePayInvoice, useRemoveInvoiceOrder } from '@/hooks/use-billing';

/**
 * Invoice detail: frozen total with member orders (PDF §4.9).
 * Marking paid is one-way and sits behind an AlertDialog that
 * states the consequence; removal from a paid invoice is blocked
 * by the server and surfaced as a toast.
 */
export function InvoiceDetail({ id }: { id: string }): React.JSX.Element {
  const { invoice, isLoading, isError, refetch } = useInvoice(id);
  const { pay, isPending: paying } = usePayInvoice(id);
  const { remove, isPending: removing } = useRemoveInvoiceOrder(id);
  const paid = invoice?.paidAt !== null && invoice?.paidAt !== undefined;

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="heading-sm">
            {invoice === undefined ? 'Invoice' : `Invoice #${invoice.invoiceNumber}`}
          </h1>
          <p className="description-sm">
            {invoice === undefined
              ? 'Frozen total with member orders.'
              : `${invoice.company.name} · ${invoice.orders.length} order${invoice.orders.length === 1 ? '' : 's'} · ${formatMoney(invoice.totalCents)}`}
          </p>
        </div>
        {invoice !== undefined && (
          <div className="flex flex-wrap items-center gap-4">
            <StatusBadge tone={paid ? 'success' : 'warning'} label={paid ? 'Paid' : 'Unpaid'} />
            {!paid && (
              <AlertDialog>
                <AlertDialogTrigger render={<Button size="sm" disabled={paying} />}>
                  Mark paid
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mark invoice #{invoice.invoiceNumber} paid?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Paying is one-way. A paid invoice is immutable: orders cannot be
                      removed from it afterwards.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={pay}>Mark paid</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}
      </div>
      <div className="bg-background-panel rounded-lg shadow-card p-6">
        {isLoading ? (
          <div className="flex min-w-0 flex-col gap-6">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-5 w-full" />
            ))}
          </div>
        ) : isError || invoice === undefined ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Could not load the invoice</EmptyTitle>
              <EmptyDescription>Something went wrong on the server.</EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
          </Empty>
        ) : (
          <div className="flex min-w-0 flex-col gap-4">
            {invoice.orders.map((order) => (
              <div key={order.id} className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-body-sm">
                  <span className="tabular-nums">#{order.orderNumber}</span> · {order.employee.name} ·{' '}
                  <span className="tabular-nums">{order.deliveryDate}</span> ·{' '}
                  <span className="tabular-nums">{formatMoney(order.totalCents)}</span>
                </p>
                {!paid && (
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={<Button variant="outline" size="sm" disabled={removing} />}
                    >
                      Remove
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove order #{order.orderNumber}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          The order becomes billable again and the invoice total is
                          recalculated. Removing the last order deletes the invoice.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(order.id)}>
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
