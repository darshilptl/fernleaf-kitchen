'use client';

import { useState } from 'react';
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
} from '@repo/ui/components/ui/alert-dialog';
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@repo/ui/components/ui/sheet';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { formatMoney } from '@repo/shared';
import { StatusBadge } from '@/components/status-badge';
import { useCompany } from '@/hooks/use-companies';
import { useReferenceList } from '@/hooks/use-catalogue';
import {
  useCancelOrder,
  useOrder,
  useOverrideDetails,
  usePlaceOrder,
  useRejectOrder,
} from '@/hooks/use-orders';
import { OrderBuilder } from './order-builder';

/**
 * Order detail: lines with choices, money breakdown, delivery
 * details and the event timeline, plus place/cancel/reject and
 * admin detail overrides. PDF §4.6.
 */
export function OrderDetail({ id }: { id: string }): React.JSX.Element {
  const { order, isLoading, isError, refetch } = useOrder(id);
  const { place, isPending: placing } = usePlaceOrder(id);
  const { cancel, isPending: cancelling } = useCancelOrder(id);
  const { reject, isPending: rejectingOrder } = useRejectOrder(id, () => setRejecting(false));
  const { override, isPending: overridingDetails } = useOverrideDetails(id);
  const [editing, setEditing] = useState(false);
  const [cancellingAsk, setCancellingAsk] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [reason, setReason] = useState('');
  const [addressId, setAddressId] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [packagingId, setPackagingId] = useState('');

  const { company } = useCompany(order?.companyId ?? '');
  const { rows: packaging } = useReferenceList('packaging-types');

  if (isLoading || order === undefined) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-body-sm">Could not load the order.</p>
        <Button variant="outline" size="sm" onClick={refetch}>
          Retry
        </Button>
      </div>
    );
  }

  const editable = order.status === 'DRAFT' || order.status === 'PLACED';
  const confirmable = order.status === 'PLACED' || order.status === 'CONFIRMED';

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="heading-sm tabular-nums">Order #{order.orderNumber}</h1>
          <p className="description-sm">
            {order.employee.name} · {order.company.name} · {order.deliveryDate}
          </p>
        </div>
        <StatusBadge tone={order.status === 'REJECTED' ? 'destructive' : 'info'} label={order.status} />
      </div>

      <div className="flex flex-wrap gap-2">
        {order.status === 'DRAFT' && (
          <Button size="sm" onClick={() => place(order.version)} disabled={placing}>
            Place order
          </Button>
        )}
        {editable && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
        {(order.status === 'DRAFT' || order.status === 'PLACED' || order.status === 'CONFIRMED') && (
          <Button variant="outline" size="sm" onClick={() => setCancellingAsk(true)}>
            Cancel
          </Button>
        )}
        {confirmable && (
          <Button variant="outline" size="sm" onClick={() => setRejecting(true)}>
            Reject
          </Button>
        )}
        {confirmable && (
          <Button variant="outline" size="sm" onClick={() => setOverriding(true)}>
            Override details
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="heading-sm">Lines</h2>
        {order.lines.length === 0 ? (
          <p className="text-body-sm">No lines yet.</p>
        ) : (
          order.lines.map((line) => (
            <div key={line.id} className="flex flex-col gap-2 rounded-lg bg-background-panel p-4 shadow-card">
              <div className="flex items-center justify-between gap-4">
                <p className="text-body font-medium">{line.dishName}</p>
                <p className="text-body-sm tabular-nums">
                  {formatMoney(line.dishPriceCents)} × {line.quantity} = {formatMoney(line.lineTotalCents)}
                </p>
              </div>
              {line.combinations.map((combination) => (
                <div key={combination.id} className="flex flex-col gap-1">
                  <p className="text-caption tabular-nums">
                    {combination.quantity} × {formatMoney(combination.unitPriceCents)} ={' '}
                    {formatMoney(combination.totalCents)}
                  </p>
                  {combination.choices.map((choice) => (
                    <p key={choice.id} className="text-caption text-foreground-muted">
                      {choice.groupName}: {choice.optionName}
                      {choice.portionSizeName === null ? '' : ` (${choice.portionSizeName})`} ·{' '}
                      {formatMoney(choice.optionPriceCents + choice.portionExtraCents)}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          ))
        )}
        <p className="text-body tabular-nums font-medium">Total {formatMoney(order.totalCents)}</p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="heading-sm">Delivery</h2>
        <p className="text-body-sm">
          {order.address.label} · {order.address.line1}, {order.address.city} {order.address.postalCode}
        </p>
        <p className="text-body-sm tabular-nums">
          {order.deliveryDate} at {Math.floor(order.deliveryTimeMinute / 60).toString().padStart(2, '0')}:
          {(order.deliveryTimeMinute % 60).toString().padStart(2, '0')} · {order.packagingType.name}
        </p>
        {order.invoiceId === null ? null : (
          <p className="text-caption text-foreground-muted">On invoice (frozen for cancel/reject).</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="heading-sm">Timeline</h2>
        {order.events.map((event) => (
          <p key={event.id} className="text-body-sm">
            {event.type}
            {event.note === null ? '' : ` — ${event.note}`}
          </p>
        ))}
      </div>

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit order</SheetTitle>
          </SheetHeader>
          <OrderBuilder order={order} onDone={() => setEditing(false)} />
        </SheetContent>
      </Sheet>

      {cancellingAsk && (
        <AlertDialog open onOpenChange={() => setCancellingAsk(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel order #{order.orderNumber}?</AlertDialogTitle>
              <AlertDialogDescription>
                The order leaves the kitchen flow. This cannot be undone from here.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep</AlertDialogCancel>
              <AlertDialogAction
                disabled={cancelling}
                onClick={() => {
                  cancel(order.version);
                  setCancellingAsk(false);
                }}
              >
                Cancel order
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {rejecting && (
        <Dialog open onOpenChange={() => setRejecting(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject order #{order.orderNumber}?</DialogTitle>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="reject-reason">Reason (required)</FieldLabel>
                <Input
                  id="reject-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejecting(false)}>
                Keep
              </Button>
              <Button
                disabled={rejectingOrder || reason.trim() === ''}
                onClick={() => reject({ version: order.version, reason: reason.trim() })}
              >
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {overriding && (
        <Dialog open onOpenChange={() => setOverriding(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Override delivery details</DialogTitle>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="override-address">Address</FieldLabel>
                <Select
                  value={addressId === '' ? 'keep' : addressId}
                  onValueChange={(value) => setAddressId(value === null || value === 'keep' ? '' : value)}
                >
                  <SelectTrigger id="override-address">
                    <SelectValue placeholder="Keep current" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">Keep current</SelectItem>
                    {(company?.addresses ?? []).map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.label} · {row.line1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="override-time">Time (minutes after midnight)</FieldLabel>
                <Input
                  id="override-time"
                  type="number"
                  min={0}
                  max={1439}
                  placeholder={String(order.deliveryTimeMinute)}
                  value={deliveryTime}
                  onChange={(event) => setDeliveryTime(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="override-packaging">Packaging</FieldLabel>
                <Select
                  value={packagingId === '' ? 'keep' : packagingId}
                  onValueChange={(value) => setPackagingId(value === null || value === 'keep' ? '' : value)}
                >
                  <SelectTrigger id="override-packaging">
                    <SelectValue placeholder="Keep current" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">Keep current</SelectItem>
                    {(packaging ?? []).map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOverriding(false)}>
                Close
              </Button>
              <Button
                disabled={overridingDetails}
                onClick={() => {
                  override({
                    version: order.version,
                    ...(addressId === '' ? {} : { addressId }),
                    ...(deliveryTime === '' ? {} : { deliveryTimeMinute: Number(deliveryTime) }),
                    ...(packagingId === '' ? {} : { packagingTypeId: packagingId }),
                  });
                  setOverriding(false);
                }}
              >
                Apply override
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
