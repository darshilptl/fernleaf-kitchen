'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { dishSchema, formatMoney, parseMoney } from '@repo/shared';
import type { DishInput } from '@repo/shared';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel } from '@repo/ui/components/ui/field';
import { Input } from '@repo/ui/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@repo/ui/components/ui/sheet';
import { ApiError } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/apply-server-errors';
import {
  useAttachOption,
  useCreateDish,
  useCreateGroup,
  useDeleteGroup,
  useDetachOption,
  useDish,
  useOptionsList,
  useReferenceList,
  useSetDishActive,
  useUpdateDish,
  useUpdateGroup,
} from '@/hooks/use-catalogue';
import type { DishRow } from '@/hooks/use-catalogue';

type DishFormValues = Omit<DishInput, 'costCents' | 'minOrderQuantity'>;
/**
 * Dish Sheet: full dish form (money as dollars strings via shared
 * parse/format) plus option groups with attach/detach, add/delete,
 * and ordering. Portions stay out until they ship.
 */
export function DishSheet({
  dish,
  onClose,
}: {
  dish?: DishRow;
  onClose: () => void;
}): React.JSX.Element {
  const isEdit = dish !== undefined;
  const { dish: detail } = useDish(isEdit && dish !== undefined ? dish.id : null);
  const { create, isPending: creating } = useCreateDish(onClose);
  const { update, isPending: updating } = useUpdateDish(dish?.id ?? '');
  const { setActive } = useSetDishActive();
  const { rows: stations } = useReferenceList('stations');
  const [costText, setCostText] = useState('');
  const [minOrderText, setMinOrderText] = useState('');
  const form = useForm<DishFormValues>({
    resolver: zodResolver(
      dishSchema.omit({ costCents: true, minOrderQuantity: true }),
    ),
    defaultValues: {
      name: '',
      description: null,
      imageUrl: null,
      sku: '',
      temperature: 'HOT',
      stationId: null,
      allergenIds: [],
      dietaryTagIds: [],
    },
  });
  const serverError = form.formState.errors.root?.server?.message;

  useEffect(() => {
    if (detail !== undefined) {
      form.reset({
        name: detail.name,
        description: detail.description,
        imageUrl: detail.imageUrl,
        sku: detail.sku,
        temperature: detail.temperature,
        stationId: detail.stationId,
        allergenIds: detail.allergens.map((row) => row.allergen.id),
        dietaryTagIds: detail.dietaryTags.map((row) => row.tag.id),
      });
      setCostText(formatMoney(detail.costCents).replace('$', ''));
      setMinOrderText(detail.minOrderQuantity === null ? '' : String(detail.minOrderQuantity));
    }
  }, [detail, form]);

  function handleSubmit(values: DishFormValues): void {
    let costCents: number;
    try {
      costCents = parseMoney(costText);
    } catch {
      form.setError('root.server', { type: 'server', message: 'Cost must look like 7.45' });
      return;
    }
    let minOrderQuantity: number | null = null;
    if (minOrderText.trim() !== '') {
      const parsed = Number.parseInt(minOrderText, 10);
      if (!Number.isInteger(parsed) || parsed < 1) {
        form.setError('root.server', { type: 'server', message: 'Minimum quantity must be 1 or more' });
        return;
      }
      minOrderQuantity = parsed;
    }
    const input: DishInput = { ...values, costCents, minOrderQuantity };
    try {
      if (isEdit && dish !== undefined) {
        update(input);
      } else {
        create(input);
      }
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        applyServerErrors(form, error);
      }
    }
  }

  return (
    <Sheet open onOpenChange={() => onClose()}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? `Edit dish: ${dish.name}` : 'New dish'}</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit(handleSubmit)();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="dish-name">Name</FieldLabel>
              <Input id="dish-name" {...form.register('name')} />
            </Field>
            <Field>
              <FieldLabel htmlFor="dish-sku">SKU</FieldLabel>
              <Input id="dish-sku" {...form.register('sku')} />
            </Field>
            <Field>
              <FieldLabel>Temperature</FieldLabel>
              <Select
                value={form.watch('temperature') ?? 'HOT'}
                onValueChange={(value) => {
                  if (value === 'HOT' || value === 'COLD') {
                    form.setValue('temperature', value);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick temperature" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOT">Hot</SelectItem>
                  <SelectItem value="COLD">Cold</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="dish-cost">Cost price ($)</FieldLabel>
              <Input
                id="dish-cost"
                placeholder="7.45"
                value={costText}
                onChange={(event) => setCostText(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="dish-min">Minimum order quantity</FieldLabel>
              <Input
                id="dish-min"
                type="number"
                value={minOrderText}
                onChange={(event) => setMinOrderText(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="dish-image">Image URL</FieldLabel>
              <Input id="dish-image" {...form.register('imageUrl')} />
            </Field>
            <Field>
              <FieldLabel htmlFor="dish-description">Description</FieldLabel>
              <Input id="dish-description" {...form.register('description')} />
            </Field>
            <Field>
              <FieldLabel>Kitchen station</FieldLabel>
              <Select
                value={form.watch('stationId') ?? ''}
                onValueChange={(value) =>
                  form.setValue('stationId', value === '' ? null : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="No station" />
                </SelectTrigger>
                <SelectContent>
                  {(stations ?? []).map((station) => (
                    <SelectItem key={station.id} value={station.id}>
                      {station.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {serverError !== undefined && <p className="text-destructive">{serverError}</p>}
          </FieldGroup>
          <SheetFooter>
            <Button type="submit" disabled={creating || updating}>
              Save dish
            </Button>
          </SheetFooter>
        </form>
        {isEdit && dish !== undefined && detail !== undefined && (
          <div className="mt-6 flex flex-col gap-4">
            <GroupManager dishId={dish.id} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActive(dish.id, !detail.isActive);
                onClose();
              }}
            >
              {detail.isActive ? 'Deactivate dish' : 'Activate dish'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function GroupManager({ dishId }: { dishId: string }): React.JSX.Element {
  const { dish } = useDish(dishId);
  const { create } = useCreateGroup(dishId);
  const [groupName, setGroupName] = useState('');
  const [required, setRequired] = useState(false);
  const groups = [...(dish?.optionGroups ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="heading-sm">Option groups</h3>
      {groups.map((group) => (
        <GroupRow key={group.id} dishId={dishId} groupId={group.id} />
      ))}
      <div className="flex items-center gap-2">
        <Input
          aria-label="New group name"
          placeholder="Group name"
          value={groupName}
          onChange={(event) => setGroupName(event.target.value)}
        />
        <label className="flex items-center gap-2 text-body-sm">
          <Checkbox checked={required} onCheckedChange={(checked) => setRequired(checked === true)} />
          Required
        </label>
        <Button
          size="sm"
          disabled={groupName.trim() === ''}
          onClick={() => {
            create({ name: groupName.trim(), isRequired: required, sortOrder: groups.length });
            setGroupName('');
            setRequired(false);
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

function GroupRow({ dishId, groupId }: { dishId: string; groupId: string }): React.JSX.Element {
  const { dish } = useDish(dishId);
  const { update } = useUpdateGroup();
  const { remove: deleteGroup } = useDeleteGroup();
  const { detach } = useDetachOption();
  const { attach } = useAttachOption(groupId);
  const { data: optionPage } = useOptionsList(1);
  const [optionId, setOptionId] = useState('');
  const group = dish?.optionGroups.find((entry) => entry.id === groupId);
  const groups = [...(dish?.optionGroups ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  if (group === undefined) {
    return <></>;
  }

  function move(direction: -1 | 1): void {
    const current = dish?.optionGroups.find((entry) => entry.id === groupId);
    if (current === undefined) {
      return;
    }
    const index = groups.findIndex((entry) => entry.id === groupId);
    const other = groups[index + direction];
    if (other === undefined || index < 0) {
      return;
    }
    update(groupId, { name: current.name, isRequired: current.isRequired, sortOrder: other.sortOrder });
    update(other.id, { name: other.name, isRequired: other.isRequired, sortOrder: current.sortOrder });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-background-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-body-sm font-medium">
          {group.name} {group.isRequired ? <Badge>Required</Badge> : <Badge>Optional</Badge>}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => move(-1)}>
            Up
          </Button>
          <Button variant="outline" size="sm" onClick={() => move(1)}>
            Down
          </Button>
          <Button variant="outline" size="sm" onClick={() => deleteGroup(group.id)}>
            Delete
          </Button>
        </div>
      </div>
      {group.options.map((link) => (
        <div key={link.option.id} className="flex items-center justify-between gap-2">
          <p className="text-body-sm">{link.option.name}</p>
          <Button variant="outline" size="sm" onClick={() => detach(group.id, link.option.id)}>
            Detach
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Select value={optionId} onValueChange={(value) => setOptionId(value ?? '')}>
          <SelectTrigger>
            <SelectValue placeholder="Pick an option" />
          </SelectTrigger>
          <SelectContent>
            {(optionPage?.items ?? []).map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={optionId === ''}
          onClick={() => {
            attach({ optionId, sortOrder: group.options.length });
            setOptionId('');
          }}
        >
          Attach
        </Button>
      </div>
    </div>
  );
}
