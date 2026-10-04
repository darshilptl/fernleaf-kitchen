'use client';

import { useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import { DatePicker } from '@/components/date-picker';
import { StatusBadge } from '@/components/status-badge';
import type { StatusTone } from '@/components/status-badge';
import { useDrivers } from '@/hooks/use-companies';
import { useAssignDriver, useDispatchDrops, useDispatchStep } from '@/hooks/use-dispatch';
import type { DropGroup, DropStatus } from '@/hooks/use-dispatch';

const DROP_TONE: Record<DropStatus, StatusTone> = {
  CONFIRMED: 'ghost',
  KITCHEN_READY: 'info',
  DISPATCH_READY: 'warning',
  OUT_FOR_DELIVERY: 'warning',
  DELIVERED: 'success',
};

function formatMinute(minute: number): string {
  const hours = Math.floor(minute / 60);
  const rest = minute % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function dropLabel(status: DropStatus): string {
  switch (status) {
    case 'CONFIRMED':
      return 'Confirmed';
    case 'KITCHEN_READY':
      return 'Kitchen ready';
    case 'DISPATCH_READY':
      return 'Dispatch ready';
    case 'OUT_FOR_DELIVERY':
      return 'Out for delivery';
    case 'DELIVERED':
      return 'Delivered';
  }
}

/**
 * Dispatch board: drops for a date with driver assignment and
 * whole-drop steps (PDF §4.8). The driver picker defaults to the
 * company default driver; steps apply to the whole drop.
 */
export function DispatchBoard(): React.JSX.Element {
  const [date, setDate] = useState('');
  const [driverByDrop, setDriverByDrop] = useState<Record<string, string>>({});
  const { data, isLoading, isError, refetch } = useDispatchDrops(date);
  const { drivers } = useDrivers();
  const { assign, isPending: assigning } = useAssignDriver();
  const { advance: ready, isPending: readying } = useDispatchStep('dispatch-ready');
  const { advance: out, isPending: outing } = useDispatchStep('out-for-delivery');
  const drops = data?.drops ?? [];

  function dropId(drop: DropGroup): string {
    return `${drop.key.companyId}|${drop.key.addressId}|${drop.key.deliveryTimeMinute}`;
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div>
        <h1 className="heading-sm">Today&apos;s drops</h1>
        <p className="description-sm">Drops by stage, with driver assignment.</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <DatePicker value={date} onChange={setDate} label="Delivery date" />
      </div>
      <div className="bg-background-panel rounded-lg shadow-card p-6">
        {isLoading ? (
          <div className="flex min-w-0 flex-col gap-6">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-5 w-full" />
            ))}
          </div>
        ) : isError ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Could not load drops</EmptyTitle>
              <EmptyDescription>Something went wrong on the server.</EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
          </Empty>
        ) : drops.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No drops</EmptyTitle>
              <EmptyDescription>No confirmed orders deliver on this date.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drops.map((drop) => {
                const id = dropId(drop);
                const first = drop.members[0];
                const currentDriver = first?.driverId ?? null;
                const fallback = first?.company?.defaultDriverId ?? '';
                const picked = driverByDrop[id] ?? currentDriver ?? fallback;
                return (
                  <TableRow key={id}>
                    <TableCell className="text-body-sm tabular-nums">
                      {formatMinute(drop.key.deliveryTimeMinute)}
                    </TableCell>
                    <TableCell className="text-body-sm">{first?.company?.name ?? '—'}</TableCell>
                    <TableCell className="text-body-sm">
                      {first?.address ? `${first.address.label} · ${first.address.line1}` : '—'}
                    </TableCell>
                    <TableCell className="text-body-sm tabular-nums">{drop.memberIds.length}</TableCell>
                    <TableCell>
                      <StatusBadge tone={DROP_TONE[drop.status]} label={dropLabel(drop.status)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Select
                          value={picked === '' || picked === undefined ? 'none' : picked}
                          onValueChange={(value) =>
                            setDriverByDrop((prev) => ({
                              ...prev,
                              [id]: value === null || value === 'none' ? '' : value,
                            }))
                          }
                        >
                          <SelectTrigger aria-label="Driver" className="w-40">
                            <SelectValue placeholder="Select driver" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Select driver</SelectItem>
                            {(drivers ?? []).map((driver) => (
                              <SelectItem key={driver.id} value={driver.id}>
                                {driver.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={picked === '' || picked === undefined || assigning}
                          onClick={() => {
                            if (picked !== undefined && picked !== '') {
                              assign(drop.key, picked);
                            }
                          }}
                        >
                          Assign
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={readying}
                          onClick={() => ready(drop.key)}
                        >
                          Dispatch ready
                        </Button>
                        <Button variant="outline" size="sm" disabled={outing} onClick={() => out(drop.key)}>
                          Out for delivery
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
