'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
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
        <div key={group.id} className="flex flex-col gap-2">
          <p className="text-body-sm font-medium">
            {group.name}
            {group.isRequired ? '' : ' (optional)'}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.isRequired ? null : (
              <Button
                variant={props.value.choices[group.id] == null ? 'default' : 'outline'}
                size="sm"
                onClick={() =>
                  props.onChange({
                    ...props.value,
                    choices: { ...props.value.choices, [group.id]: null },
                  })
                }
              >
                None
              </Button>
            )}
            {group.options.map((option) => (
              <Button
                key={option.id}
                variant={props.value.choices[group.id] === option.id ? 'default' : 'outline'}
                size="sm"
                onClick={() =>
                  props.onChange({
                    ...props.value,
                    choices: { ...props.value.choices, [group.id]: option.id },
                  })
                }
              >
                {option.name} · {formatMoney(option.priceCents)}
              </Button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-body-sm">
          Qty
          <Input
            aria-label="Combination quantity"
            type="number"
            min={1}
            className="w-20"
            value={props.value.quantity}
            onChange={(event) =>
              props.onChange({ ...props.value, quantity: Math.max(1, Number(event.target.value)) })
            }
          />
        </label>
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
