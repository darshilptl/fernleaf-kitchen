'use client';

import { useMemo, useState } from 'react';
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
import { useDoneUnit, useForceComplete, useKitchenBoard, useStartUnit } from '@/hooks/use-kitchen';

const LATENESS_TONE: Record<string, StatusTone> = {
  DONE: 'success',
  LATE: 'destructive',
  AT_RISK: 'warning',
  ON_TRACK: 'info',
};

function formatMinute(minute: number): string {
  const hours = Math.floor(minute / 60);
  const rest = minute % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

/**
 * Kitchen board: prep units for a delivery date with a station
 * filter (PDF §4.7). Late and at-risk work is obvious: a word via
 * StatusBadge plus a left border. Force-complete sits behind an
 * AlertDialog that states the consequence.
 */
export function KitchenBoard(): React.JSX.Element {
  const [date, setDate] = useState('');
  const [station, setStation] = useState('');
  const { data, isLoading, isError, refetch } = useKitchenBoard(date, station);
  const { start, isPending: starting } = useStartUnit();
  const { done, isPending: finishing } = useDoneUnit();
  const { forceComplete, isPending: forcing } = useForceComplete();
  const units = data?.units ?? [];

  const stations = useMemo(() => {
    const seen = new Map<string, string>();
    for (const unit of units) {
      if (unit.stationId !== null) {
        seen.set(unit.stationId, unit.stationName);
      }
    }
    return [...seen.entries()];
  }, [units]);

  const orders = useMemo(() => {
    const seen = new Map<string, { orderNumber: number; version: number }>();
    for (const unit of units) {
      if (!seen.has(unit.orderId)) {
        seen.set(unit.orderId, { orderNumber: unit.orderNumber, version: unit.version });
      }
    }
    return [...seen.entries()];
  }, [units]);

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div>
        <h1 className="heading-sm">Today&apos;s prep</h1>
        <p className="description-sm">Prep units by station, with late and at-risk work.</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <DatePicker value={date} onChange={setDate} label="Delivery date" />
        <Select
          value={station === '' ? 'all' : station}
          onValueChange={(value) => setStation(value === null || value === 'all' ? '' : value)}
        >
          <SelectTrigger aria-label="Station filter" className="w-48">
            <SelectValue placeholder="All stations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stations</SelectItem>
            {stations.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              <EmptyTitle>Could not load the board</EmptyTitle>
              <EmptyDescription>Something went wrong on the server.</EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
          </Empty>
        ) : units.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No prep units</EmptyTitle>
              <EmptyDescription>No confirmed orders cook for this date.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex min-w-0 flex-col gap-6">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((unit) => (
                  <TableRow
                    key={unit.id}
                    className={
                      unit.lateness === 'LATE'
                        ? 'border-l-2 border-destructive'
                        : unit.lateness === 'AT_RISK'
                          ? 'border-l-2 border-warning'
                          : undefined
                    }
                  >
                    <TableCell className="text-body-sm">
                      {unit.dishName} × <span className="tabular-nums">{unit.quantity}</span>
                    </TableCell>
                    <TableCell className="text-body-sm tabular-nums">#{unit.orderNumber}</TableCell>
                    <TableCell className="text-body-sm">{unit.stationName}</TableCell>
                    <TableCell className="text-body-sm tabular-nums">
                      {formatMinute(unit.deliveryTimeMinute)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        tone={LATENESS_TONE[unit.lateness] ?? 'ghost'}
                        label={
                          unit.doneAt !== null
                            ? 'Done'
                            : unit.lateness === 'LATE'
                              ? unit.startedAt !== null
                                ? 'Started · Late'
                                : 'Late'
                              : unit.lateness === 'AT_RISK'
                                ? unit.startedAt !== null
                                  ? 'Started · At risk'
                                  : 'At risk'
                                : unit.startedAt !== null
                                  ? 'Started · On track'
                                  : 'On track'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={unit.startedAt !== null || starting}
                          onClick={() => start(unit.id)}
                        >
                          Start
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={unit.doneAt !== null || finishing}
                          onClick={() => done(unit.id)}
                        >
                          Done
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex flex-col gap-2">
              <p className="text-caption text-foreground-muted">Force-complete a whole order</p>
              <div className="flex flex-wrap gap-2">
                {orders.map(([orderId, order]) => (
                  <AlertDialog key={orderId}>
                    <AlertDialogTrigger
                      render={<Button variant="outline" size="sm" disabled={forcing} />}
                    >
                      Force-complete #{order.orderNumber}
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Force-complete order #{order.orderNumber}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Every open prep unit on this order is marked started and done, and the
                          order is marked kitchen ready. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => forceComplete(orderId, order.version)}>
                          Force-complete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
