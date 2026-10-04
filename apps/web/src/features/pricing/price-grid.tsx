'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatMoney, parseMoney } from '@repo/shared';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Input } from '@repo/ui/components/ui/input';
import { DataTable } from '@/components/data-table';
import {
  useClearTypedPrice,
  useSaveBatchPrices,
  useTierGrid,
} from '@/hooks/use-pricing';
import type { GridRow } from '@/hooks/use-pricing';

/**
 * Typed-price grid for one tier. Every row shows the manual price
 * (editable dollars string), the effective price, and its source.
 * Save writes the batch in one transaction; clearing a price
 * deletes the row so the effective falls back to derived.
 */
export function PriceGrid({ tierId }: { tierId: string }): React.JSX.Element {
  const [missingOnly, setMissingOnly] = useState(false);
  const { rows, isLoading, isError, refetch } = useTierGrid(tierId, missingOnly);
  const clearDrafts = useCallback((): void => {
    setDrafts({});
    setFormError(undefined);
  }, []);
  const { save, isPending } = useSaveBatchPrices(tierId, clearDrafts);
  const { clear } = useClearTypedPrice(tierId);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const list = rows ?? [];

  useEffect(() => {
    clearDrafts();
  }, [tierId, missingOnly, clearDrafts]);

  function handleSave(): void {
    setFormError(undefined);
    const dishPrices: Array<{ itemId: string; priceCents: number }> = [];
    const optionPrices: Array<{ itemId: string; priceCents: number }> = [];
    try {
      for (const row of list) {
        const draft = drafts[`${row.kind}:${row.id}`];
        if (draft === undefined || draft.trim() === '') {
          continue;
        }
        const priceCents = parseMoney(draft);
        if (row.kind === 'dish') {
          dishPrices.push({ itemId: row.id, priceCents });
        } else {
          optionPrices.push({ itemId: row.id, priceCents });
        }
      }
    } catch {
      setFormError('Prices must look like 7.45');
      return;
    }
    save({ dishPrices, optionPrices });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="heading-sm">Tier prices</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-body-sm">
            <Checkbox
              checked={missingOnly}
              onCheckedChange={(checked) => setMissingOnly(checked === true)}
            />
            Missing prices only
          </label>
          <Button size="sm" disabled={isPending} onClick={handleSave}>
            Save prices
          </Button>
        </div>
      </div>
      {formError !== undefined && <p className="text-destructive">{formError}</p>}
      <DataTable<GridRow>
        columns={[
          { key: 'name', header: 'Item', render: (row) => row.name },
          { key: 'kind', header: 'Kind', render: (row) => row.kind },
          {
            key: 'manual',
            header: 'Typed price',
            render: (row) => (
              <Input
                aria-label={`Typed price for ${row.name}`}
                placeholder={row.manualCents === null ? '' : formatMoney(row.manualCents)}
                value={drafts[`${row.kind}:${row.id}`] ?? ''}
                onChange={(event) =>
                  setDrafts((prev) => ({ ...prev, [`${row.kind}:${row.id}`]: event.target.value }))
                }
              />
            ),
          },
          {
            key: 'effective',
            header: 'Effective',
            render: (row) =>
              row.effectiveCents === null ? (
                <span className="text-caption">—</span>
              ) : (
                <span className="tabular-nums">{formatMoney(row.effectiveCents)}</span>
              ),
          },
          {
            key: 'source',
            header: 'Source',
            render: (row) =>
              row.source === 'MANUAL' ? (
                <Badge>Manual</Badge>
              ) : row.source === 'DERIVED' ? (
                <Badge>Derived</Badge>
              ) : (
                <Badge>None</Badge>
              ),
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) =>
              row.manualCents === null ? (
                <span className="text-caption">—</span>
              ) : (
                <Button variant="outline" size="sm" onClick={() => clear(row.kind, row.id)}>
                  Clear
                </Button>
              ),
          },
        ]}
        rows={list}
        getRowId={(row) => `${row.kind}:${row.id}`}
        page={1}
        pageSize={list.length === 0 ? 20 : list.length}
        total={list.length}
        onPageChange={() => undefined}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyTitle="No missing prices"
        emptyDescription="Every item has an effective price on this tier."
      />
    </div>
  );
}
