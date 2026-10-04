'use client';

import { useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@repo/ui/components/ui/empty';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@repo/ui/components/ui/sheet';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { StatusBadge } from '@/components/status-badge';
import { useMarkDelivered, useOwnDrops } from '@/hooks/use-driver';
import type { DropGroup } from '@/hooks/use-dispatch';

function formatMinute(minute: number): string {
  const hours = Math.floor(minute / 60);
  const rest = minute % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

/**
 * Driver view: own drops for today in time order, mobile-first
 * (PDF §4.8). Delivered is enabled only when the drop is out for
 * delivery; the sheet takes an optional note and photo URL.
 */
export function DriverDrops(): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useOwnDrops();
  const { deliver, isPending } = useMarkDelivered();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const drops = data?.drops ?? [];

  function dropId(drop: DropGroup): string {
    return `${drop.key.companyId}|${drop.key.addressId}|${drop.key.deliveryTimeMinute}`;
  }

  function close(): void {
    setOpenKey(null);
    setNote('');
    setPhotoUrl('');
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div>
        <h1 className="heading-sm">My drops for today</h1>
        <p className="description-sm">Your drops in time order.</p>
      </div>
      {isLoading ? (
        <div className="flex min-w-0 flex-col gap-6">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="bg-background-panel rounded-lg shadow-card p-6">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Could not load drops</EmptyTitle>
              <EmptyDescription>Something went wrong on the server.</EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
          </Empty>
        </div>
      ) : drops.length === 0 ? (
        <div className="bg-background-panel rounded-lg shadow-card p-6">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No drops yet</EmptyTitle>
              <EmptyDescription>
                Your drops for today in time order will appear here once dispatch assigns them.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-6">
          {drops.map((drop) => {
            const id = dropId(drop);
            const first = drop.members[0];
            const out = drop.status === 'OUT_FOR_DELIVERY';
            const delivered = drop.status === 'DELIVERED';
            return (
              <div key={id} className="bg-background-panel rounded-lg shadow-card p-6">
                <div className="flex flex-col gap-2">
                  <p className="text-body-sm tabular-nums">{formatMinute(drop.key.deliveryTimeMinute)}</p>
                  <p className="heading-sm">
                    {first?.address ? `${first.address.label} · ${first.address.line1}` : 'Drop'}
                  </p>
                  <p className="text-caption text-foreground-muted">
                    {first?.company?.name ?? ''} · {drop.memberIds.length} order
                    {drop.memberIds.length === 1 ? '' : 's'}
                  </p>
                  <StatusBadge
                    tone={delivered ? 'success' : out ? 'warning' : 'ghost'}
                    label={delivered ? 'Delivered' : out ? 'Out for delivery' : 'Not ready yet'}
                  />
                  <Button
                    className="h-11 w-full"
                    disabled={!out || isPending}
                    onClick={() => setOpenKey(id)}
                  >
                    {delivered ? 'Delivered' : 'Mark delivered'}
                  </Button>
                </div>
                <Sheet
                  open={openKey === id}
                  onOpenChange={(open) => {
                    if (!open) {
                      close();
                    }
                  }}
                >
                  <SheetContent side="bottom">
                    <SheetHeader>
                      <SheetTitle>Mark delivered</SheetTitle>
                      <SheetDescription>
                        {formatMinute(drop.key.deliveryTimeMinute)} · {drop.memberIds.length} order
                        {drop.memberIds.length === 1 ? '' : 's'}
                      </SheetDescription>
                    </SheetHeader>
                    <div className="flex flex-col gap-4 py-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`note-${id}`}>Note (optional)</Label>
                        <Input
                          id={`note-${id}`}
                          value={note}
                          maxLength={500}
                          onChange={(event) => setNote(event.target.value)}
                          placeholder="Gate code, receiver, …"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`photo-${id}`}>Photo URL (optional)</Label>
                        <Input
                          id={`photo-${id}`}
                          value={photoUrl}
                          inputMode="url"
                          onChange={(event) => setPhotoUrl(event.target.value)}
                          placeholder="https://…"
                        />
                      </div>
                    </div>
                    <SheetFooter>
                      <Button
                        className="h-11 w-full"
                        disabled={isPending}
                        onClick={() =>
                          deliver(
                            drop.key,
                            note === '' ? undefined : note,
                            photoUrl === '' ? undefined : photoUrl,
                          )
                        }
                      >
                        Confirm delivery
                      </Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
