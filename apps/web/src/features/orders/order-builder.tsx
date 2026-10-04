'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { formatMoney } from '@repo/shared';
import { useCompanies, useCompany } from '@/hooks/use-companies';
import { useEmployees } from '@/hooks/use-employees';
import { useMenuPreview } from '@/hooks/use-menu';
import type { PreviewItem } from '@/hooks/use-menu';
import { useReferenceList } from '@/hooks/use-catalogue';
import { useCreateOrder, useUpdateOrder } from '@/hooks/use-orders';
import type { OrderDetail } from '@/hooks/use-orders';
import { DatePicker } from '@/components/date-picker';
import { CombinationBuilder } from './combination-builder';
import type { ComboDraft } from './combination-builder';

interface LineDraft {
  dish: PreviewItem;
  combos: ComboDraft[];
}

function emptyCombo(groups: PreviewItem['groups']): ComboDraft {
  const choices: Record<string, string | null> = {};
  for (const group of groups) {
    choices[group.id] = null;
  }
  return { quantity: 1, choices };
}

/**
 * Order create flow (and draft edit): employee, delivery date,
 * that employee's menu, line and combination builder, price
 * preview, save draft. Placing happens on the detail page after
 * a final server revalidation.
 */
export function OrderBuilder(props: { order?: OrderDetail; onDone: () => void }): React.JSX.Element {
  const editing = props.order;
  const [companyId, setCompanyId] = useState(editing?.companyId ?? '');
  const [employeeId, setEmployeeId] = useState(editing?.employeeId ?? '');
  const [deliveryDate, setDeliveryDate] = useState(editing?.deliveryDate ?? '');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [prefilled, setPrefilled] = useState(editing === undefined);
  const [addressId, setAddressId] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [packagingId, setPackagingId] = useState('');
  const [error, setError] = useState('');

  const { data: companies } = useCompanies(1, '');
  const { company } = useCompany(companyId);
  const { data: employees } = useEmployees(companyId, 1);
  const { preview } = useMenuPreview(employeeId === '' ? null : employeeId);
  const { rows: packaging } = useReferenceList('packaging-types');
  const { create, isPending: creating } = useCreateOrder(() => props.onDone());
  const { update, isPending: updating } = useUpdateOrder(editing?.id ?? '', () => {
    if (editing !== undefined) {
      props.onDone();
    }
  });

  const dishes = useMemo(() => preview?.categories.flatMap((category) => category.items) ?? [], [preview]);

  useEffect(() => {
    if (editing !== undefined && !prefilled && dishes.length > 0) {
      setLines(
        editing.lines.map((line) => {
          const dish = dishes.find((row) => row.dishId === line.dishId);
          return {
            dish: dish ?? {
              itemId: '',
              dishId: line.dishId,
              name: line.dishName,
              description: null,
              imageUrl: null,
              temperature: '',
              minOrderQuantity: null,
              allergens: [],
              dietaryTags: [],
              priceCents: line.dishPriceCents,
              groups: [],
            },
            combos: line.combinations.map((combination) => {
              const choices: Record<string, string | null> = {};
              for (const group of dish?.groups ?? []) {
                const hit = combination.choices.find((choice) =>
                  group.options.some((option) => option.id === choice.optionId),
                );
                choices[group.id] = hit?.optionId ?? null;
              }
              return { quantity: combination.quantity, choices };
            }),
          };
        }),
      );
      setPrefilled(true);
    }
  }, [editing, prefilled, dishes]);

  const previewTotal = lines.reduce(
    (sum, line) =>
      sum +
      line.combos.reduce((comboSum, combo) => {
        const unit =
          line.dish.priceCents +
          Object.values(combo.choices).reduce((optionSum, optionId) => {
            const option = line.dish.groups
              .flatMap((group) => group.options)
              .find((row) => row.id === optionId);
            return optionSum + (option?.priceCents ?? 0);
          }, 0);
        return comboSum + unit * combo.quantity;
      }, 0),
    0,
  );

  function submit(): void {
    setError('');
    if (editing === undefined && (employeeId === '' || deliveryDate === '')) {
      setError('Choose an employee and a delivery date first.');
      return;
    }
    const details =
      addressId === '' && deliveryTime === '' && packagingId === ''
        ? undefined
        : {
            addressId:
              addressId === '' ? (company?.addresses.find((row) => row.isDefault)?.id ?? '') : addressId,
            deliveryTimeMinute:
              deliveryTime === '' ? (company?.defaultDeliveryMinute ?? 720) : Number(deliveryTime),
            packagingTypeId:
              packagingId === '' ? (company?.defaultPackagingTypeId ?? '') : packagingId,
          };
    if (details !== undefined && (details.addressId === '' || details.packagingTypeId === '')) {
      setError('Pick a company first so defaults can resolve.');
      return;
    }
    const payloadLines = lines.map((line) => ({
      dishId: line.dish.dishId,
      combinations: line.combos.map((combo) => ({
        quantity: combo.quantity,
        choices: Object.values(combo.choices)
          .filter((optionId): optionId is string => optionId !== null)
          .map((optionId) => ({ optionId })),
      })),
    }));
    if (editing === undefined) {
      create({
        employeeId,
        deliveryDate,
        ...(details === undefined ? {} : { details }),
        lines: payloadLines,
      });
    } else {
      update({
        version: editing.version,
        ...(details === undefined ? {} : { details }),
        lines: payloadLines,
      });
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {error === '' ? null : <p className="text-body-sm text-destructive">{error}</p>}
      {editing === undefined ? (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="order-company">Company</FieldLabel>
            <Select value={companyId === '' ? 'none' : companyId} onValueChange={(value) => setCompanyId(value ?? '')}>
              <SelectTrigger id="order-company">
                <SelectValue placeholder="Choose a company" />
              </SelectTrigger>
              <SelectContent>
<SelectGroup>
                {(companies?.items ?? []).map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectGroup>
</SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="order-employee">Employee</FieldLabel>
            <Select value={employeeId === '' ? 'none' : employeeId} onValueChange={(value) => setEmployeeId(value ?? '')}>
              <SelectTrigger id="order-employee">
                <SelectValue placeholder="Choose an employee" />
              </SelectTrigger>
              <SelectContent>
<SelectGroup>
                {(employees?.items ?? []).map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectGroup>
</SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Delivery date</FieldLabel>
            <DatePicker value={deliveryDate} onChange={setDeliveryDate} label="Delivery date" />
          </Field>
        </FieldGroup>
      ) : (
        <p className="description-sm">
          {editing.employee.name} · {editing.deliveryDate} · the delivery date cannot change
          after creation.
        </p>
      )}
      {employeeId === '' && editing === undefined ? null : (
        <div className="flex min-w-0 flex-col gap-6">
          <h3 className="heading-sm">Menu</h3>
          {dishes.length === 0 ? (
            <p className="text-body-sm">No dishes available for this employee.</p>
          ) : (
            dishes.map((dish) => (
              <div key={dish.dishId} className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-body font-medium">{dish.name}</p>
                  <p className="text-caption tabular-nums">{formatMoney(dish.priceCents)}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={lines.some((line) => line.dish.dishId === dish.dishId)}
                  onClick={() => setLines([...lines, { dish, combos: [emptyCombo(dish.groups)] }])}
                >
                  Add
                </Button>
              </div>
            ))
          )}
        </div>
      )}
      {lines.map((line, lineIndex) => (
        <div key={line.dish.dishId} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-body font-medium">{line.dish.name}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLines(lines.filter((_, index) => index !== lineIndex))}
            >
              Remove dish
            </Button>
          </div>
          {line.combos.map((combo, comboIndex) => (
            <CombinationBuilder
              key={comboIndex}
              groups={line.dish.groups}
              dishPriceCents={line.dish.priceCents}
              value={combo}
              onChange={(value) =>
                setLines(
                  lines.map((row, index) =>
                    index === lineIndex
                      ? { ...row, combos: row.combos.map((item, itemIndex) => (itemIndex === comboIndex ? value : item)) }
                      : row,
                  ),
                )
              }
              onRemove={
                line.combos.length > 1
                  ? () =>
                      setLines(
                        lines.map((row, index) =>
                          index === lineIndex
                            ? { ...row, combos: row.combos.filter((_, itemIndex) => itemIndex !== comboIndex) }
                            : row,
                        ),
                      )
                  : null
              }
            />
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setLines(
                lines.map((row, index) =>
                  index === lineIndex
                    ? { ...row, combos: [...row.combos, emptyCombo(row.dish.groups)] }
                    : row,
                ),
              )
            }
          >
            Add combination
          </Button>
        </div>
      ))}
      <div className="flex min-w-0 flex-col gap-6">
        <h3 className="heading-sm">Delivery details</h3>
        <p className="description-sm">Leave blank to use the company defaults.</p>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="order-address">Address</FieldLabel>
          <Select
            value={addressId === '' ? 'default' : addressId}
            onValueChange={(value) => setAddressId(value === null || value === 'default' ? '' : value)}
          >
            <SelectTrigger id="order-address">
              <SelectValue placeholder="Company default" />
            </SelectTrigger>
            <SelectContent>
<SelectGroup>
              <SelectItem value="default">Company default</SelectItem>
              {(company?.addresses ?? []).map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.label} · {row.line1}
                </SelectItem>
              ))}
            </SelectGroup>
</SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="order-time">Time (minutes after midnight)</FieldLabel>
          <Input
            id="order-time"
            type="number"
            min={0}
            max={1439}
            placeholder={company === undefined ? '' : String(company.defaultDeliveryMinute)}
            value={deliveryTime}
            onChange={(event) => setDeliveryTime(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="order-packaging">Packaging</FieldLabel>
          <Select
            value={packagingId === '' ? 'default' : packagingId}
            onValueChange={(value) => setPackagingId(value === null || value === 'default' ? '' : value)}
          >
            <SelectTrigger id="order-packaging">
              <SelectValue placeholder={company?.defaultPackaging.name ?? 'Company default'} />
            </SelectTrigger>
            <SelectContent>
<SelectGroup>
              <SelectItem value="default">Company default</SelectItem>
              {(packaging ?? []).map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectGroup>
</SelectContent>
          </Select>
          </Field>
        </FieldGroup>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body tabular-nums font-medium">Preview {formatMoney(previewTotal)}</p>
        <Button size="sm" onClick={submit} disabled={creating || updating}>
          Save draft
        </Button>
      </div>
    </div>
  );
}
