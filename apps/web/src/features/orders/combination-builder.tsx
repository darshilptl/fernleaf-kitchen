'use client';

import { useId } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Field, FieldLabel } from '@repo/ui/components/ui/field';
import { Input } from '@repo/ui/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@repo/ui/components/ui/toggle-group';
import { formatMoney } from '@repo/shared';
import type { PreviewGroup } from '@/hooks/use-menu';

export interface ComboDraft {
  quantity: number;
  choices: Record<string, string | null>;
}

/**
 * One combination editor: exactly one option per required group,
 * at most one per optional group, plus a quantity. The price is a
 * client-side preview (integer cents of shown prices); the server
 * reprices authoritatively on save.
 */
export function CombinationBuilder(props: {
  groups: PreviewGroup[];
  dishPriceCents: number;
  value: ComboDraft;
  onChange: (value: ComboDraft) => void;
  onRemove: (() => void) | null;
}): React.JSX.Element {
  const qtyId = useId();
  const unit =
    props.dishPriceCents +
    Object.values(props.value.choices).reduce((sum, optionId) => {
      if (optionId === null) {
        return sum;
      }
      const option = props.groups.flatMap((group) => group.options).find((row) => row.id === optionId);
      return sum + (option?.priceCents ?? 0);
    }, 0);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-subtle p-4">
      {props.groups.map((group) => (
        <Field key={group.id}>
          <FieldLabel>
            {group.name}
            {group.isRequired ? '' : ' (optional)'}
          </FieldLabel>
          <ToggleGroup
            aria-label={group.name}
            value={[props.value.choices[group.id] ?? 'none']}
            onValueChange={(values) => {
              const next = values[0];
              if (next !== undefined) {
                props.onChange({
                  ...props.value,
                  choices: { ...props.value.choices, [group.id]: next === 'none' ? null : next },
                });
              }
            }}
          >
            {group.isRequired ? null : <ToggleGroupItem value="none">None</ToggleGroupItem>}
            {group.options.map((option) => (
              <ToggleGroupItem key={option.id} value={option.id}>
                {option.name} · {formatMoney(option.priceCents)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Field orientation="horizontal">
          <FieldLabel htmlFor={qtyId} className="font-normal">
            Qty
          </FieldLabel>
          <Input
            id={qtyId}
            type="number"
            min={1}
            className="w-20"
            value={props.value.quantity}
            onChange={(event) =>
              props.onChange({ ...props.value, quantity: Math.max(1, Number(event.target.value)) })
            }
          />
        </Field>
        <p className="text-body-sm tabular-nums">
          {formatMoney(unit)} each · {formatMoney(unit * props.value.quantity)}
        </p>
        {props.onRemove === null ? null : (
          <Button variant="outline" size="sm" onClick={props.onRemove}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
