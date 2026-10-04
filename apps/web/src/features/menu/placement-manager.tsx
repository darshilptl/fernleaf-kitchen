'use client';

import { useState } from 'react';
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
} from '@repo/ui/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
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
  const [hiding, setHiding] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="heading-sm">Dish placements</h2>
      {(categories ?? []).map((category) => (
        <div
          key={category.id}
          id={`placements-${category.id}`}
          className="flex flex-col gap-4 rounded-lg bg-background-panel p-6 shadow-card"
        >
          <div className="flex items-center justify-between gap-4">
            <p className="text-body-sm font-medium">
              {category.name} <span className="text-caption text-foreground-muted">/{category.slug}</span>
            </p>
            <Button variant="outline" size="sm" onClick={() => setAddingTo(category.id)}>
              Add dish
            </Button>
          </div>
          {category.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4">
              <p className="text-body-sm">
                {item.dish.name} {!item.isActive && '(hidden)'}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    item.isActive
                      ? setHiding({ id: item.id, name: item.dish.name })
                      : update(item.id, { isActive: true })
                  }
                >
                  {item.isActive ? 'Hide' : 'Show'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => remove(item.id)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
          {addingTo === category.id && (
            <div className="flex items-center gap-2">
              <Select value={dishId} onValueChange={(value) => setDishId(value ?? '')}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Pick a dish" />
                </SelectTrigger>
                <SelectContent>
                  {(dishes ?? []).map((dish) => (
                    <SelectItem key={dish.id} value={dish.id}>
                      {dish.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
      {hiding !== null && (
        <AlertDialog open onOpenChange={() => setHiding(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hide {hiding.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This placement disappears from every employee menu until shown again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  update(hiding.id, { isActive: false });
                  setHiding(null);
                }}
              >
                Hide
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
