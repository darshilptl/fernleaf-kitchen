'use client';

import { useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Field, FieldLabel } from '@repo/ui/components/ui/field';
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { useDishes } from '@/hooks/use-catalogue';
import {
  useAddPlacement,
  useDeletePlacement,
  useMenuCategories,
  useUpdatePlacement,
} from '@/hooks/use-menu';

/**
 * Dish placements per category: add dishes, toggle item
 * visibility, remove placements. Order follows the category's
 * item sort; global reorder lives on the category list.
 */
export function PlacementManager(): React.JSX.Element {
  const { categories } = useMenuCategories();
  const { data: dishPage } = useDishes(1);
  const dishes = dishPage?.items.filter((dish) => dish.isActive);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [dishId, setDishId] = useState('');
  const { add, isPending } = useAddPlacement(addingTo ?? '');
  const { update } = useUpdatePlacement();
  const { remove } = useDeletePlacement();
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h2 className="heading-sm">Dish placements</h2>
      {(categories ?? []).map((category) => (
        <div
          key={category.id}
          id={`placements-${category.id}`}
          className="flex min-w-0 flex-col gap-6 rounded-lg bg-background-panel p-6 shadow-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-body-sm font-medium">
              {category.name} <span className="text-caption text-foreground-muted">/{category.slug}</span>
            </p>
            <Button variant="outline" size="sm" onClick={() => setAddingTo(category.id)}>
              Add dish
            </Button>
          </div>
          {category.items.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-body-sm">
                {item.dish.name} {!item.isActive && '(hidden)'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => update(item.id, { isActive: !item.isActive })}
                >
                  {item.isActive ? 'Hide' : 'Show'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRemoving({ id: item.id, name: item.dish.name })}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
          {addingTo === category.id && (
            <div className="flex flex-wrap items-end gap-4">
              <Field>
                <FieldLabel htmlFor={`pick-dish-${category.id}`}>Dish</FieldLabel>
              <Select value={dishId} onValueChange={(value) => setDishId(value ?? '')}>
                <SelectTrigger id={`pick-dish-${category.id}`} className="w-64">
                  <SelectValue placeholder="Pick a dish" />
                </SelectTrigger>
                <SelectContent>
<SelectGroup>
                  {(dishes ?? []).map((dish) => (
                    <SelectItem key={dish.id} value={dish.id}>
                      {dish.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
</SelectContent>
              </Select>
              </Field>
              <Button
                size="sm"
                disabled={isPending || dishId === ''}
                onClick={() => {
                  add({ dishId, sortOrder: category.items.length });
                  setDishId('');
                  setAddingTo(null);
                }}
              >
                Add
              </Button>
            </div>
          )}
        </div>
      ))}
      {removing !== null && (
        <AlertDialog open onOpenChange={() => setRemoving(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {removing.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                The placement is removed from this category. The dish itself stays.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  remove(removing.id);
                  setRemoving(null);
                }}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
