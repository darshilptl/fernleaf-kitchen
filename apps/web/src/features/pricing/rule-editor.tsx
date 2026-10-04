'use client';

import { useEffect, useState } from 'react';
import { parseMultiplier } from '@repo/shared';
import { Button } from '@repo/ui/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@repo/ui/components/ui/field';
import { Input } from '@repo/ui/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { usePriceTiers, useSaveRule } from '@/hooks/use-pricing';

type Basis = 'none' | 'COST' | 'TIER';

/**
 * Derivation rule editor for one tier: no rule, cost ×
 * multiplier, or source tier + percent. The multiplier is typed
 * as "2.4" or "+15%" and parsed by shared math on submit; parse
 * failures surface as field errors, server rule errors as toasts.
 */
export function RuleEditor({ tierId }: { tierId: string }): React.JSX.Element {
  const { tiers } = usePriceTiers();
  const { save, isPending } = useSaveRule(tierId);
  const current = tiers?.find((tier) => tier.id === tierId);
  const [basis, setBasis] = useState<Basis>(
    current?.derivationBasis ?? 'none',
  );
  const [sourceTierId, setSourceTierId] = useState<string>(current?.sourceTierId ?? '');
  const [multiplierText, setMultiplierText] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (current !== undefined) {
      setBasis(current.derivationBasis ?? 'none');
      setSourceTierId(current.sourceTierId ?? '');
    }
  }, [current]);

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    setFieldError(undefined);
    if (basis === 'none') {
      save({ derivationBasis: null, sourceTierId: null, multiplierBp: null });
      return;
    }
    let multiplierBp: number;
    try {
      multiplierBp = parseMultiplier(multiplierText);
    } catch {
      setFieldError('Enter a multiplier like 2.4 or +15%');
      return;
    }
    if (basis === 'TIER' && sourceTierId === '') {
      setFieldError('Pick a source tier');
      return;
    }
    save({
      derivationBasis: basis,
      sourceTierId: basis === 'TIER' ? sourceTierId : null,
      multiplierBp,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="rule-basis">Basis</FieldLabel>
          <Select
            value={basis}
            onValueChange={(value) => {
              if (value === 'COST' || value === 'TIER' || value === 'none') {
                setBasis(value);
              }
            }}
          >
            <SelectTrigger id="rule-basis">
              <SelectValue placeholder="No derivation" />
            </SelectTrigger>
            <SelectContent>
<SelectGroup>
              <SelectItem value="none">No derivation</SelectItem>
              <SelectItem value="COST">Cost × multiplier</SelectItem>
              <SelectItem value="TIER">Other tier + percent</SelectItem>
            </SelectGroup>
</SelectContent>
          </Select>
        </Field>
        {basis === 'TIER' && (
          <Field>
            <FieldLabel htmlFor="rule-source">Source tier</FieldLabel>
            <Select value={sourceTierId} onValueChange={(value) => setSourceTierId(value ?? '')}>
              <SelectTrigger id="rule-source">
                <SelectValue placeholder="Pick a tier" />
              </SelectTrigger>
              <SelectContent>
<SelectGroup>
                {(tiers ?? [])
                  .filter((tier) => tier.id !== tierId)
                  .map((tier) => (
                    <SelectItem key={tier.id} value={tier.id}>
                      {tier.name}
                    </SelectItem>
                  ))}
              </SelectGroup>
</SelectContent>
            </Select>
          </Field>
        )}
        {basis !== 'none' && (
          <Field>
            <FieldLabel htmlFor="rule-multiplier">Multiplier</FieldLabel>
            <Input
              id="rule-multiplier"
              placeholder={basis === 'COST' ? '2.4' : '+15%'}
              value={multiplierText}
              onChange={(event) => setMultiplierText(event.target.value)}
              aria-invalid={fieldError !== undefined}
            />
            {fieldError !== undefined && <p className="text-body-sm text-destructive">{fieldError}</p>}
          </Field>
        )}
        <div>
          <Button type="submit" size="sm" disabled={isPending}>
            Save rule
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
