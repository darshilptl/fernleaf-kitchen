'use client';

import { useEffect, useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { useCompany, useSetHidden } from '@/hooks/use-companies';
import { useMenuCategories } from '@/hooks/use-menu';

/**
 * Company menu visibility: hidden categories and hidden dish
 * placements. Saved as a full-set replace in one transaction.
 * Pricing tier link lives on the profile tab.
 */
export function MenuVisibilityTab({ companyId }: { companyId: string }): React.JSX.Element {
  const { company } = useCompany(companyId);
  const { categories } = useMenuCategories();
  const { save: saveCategories, isPending: savingCategories } = useSetHidden(
    companyId,
    'hidden-categories',
  );
  const { save: saveItems, isPending: savingItems } = useSetHidden(companyId, 'hidden-items');
  const [hiddenCategories, setHiddenCategories] = useState<ReadonlySet<string>>(new Set());
  const [hiddenItems, setHiddenItems] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (company !== undefined) {
      setHiddenCategories(new Set(company.hiddenCategories.map((row) => row.categoryId)));
      setHiddenItems(new Set(company.hiddenItems.map((row) => row.menuItemId)));
    }
  }, [company]);

  if (company === undefined) {
    return <p className="text-body-sm">Loading company…</p>;
  }

  function toggle(set: ReadonlySet<string>, apply: (next: ReadonlySet<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    apply(next);
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="heading-sm">Hidden categories</h2>
          <Button
            size="sm"
            disabled={savingCategories}
            onClick={() => saveCategories([...hiddenCategories])}
          >
            Save categories
          </Button>
        </div>
        {(categories ?? []).map((category) => (
          <label key={category.id} className="flex items-center gap-2 text-body-sm">
            <Checkbox
              checked={hiddenCategories.has(category.id)}
              onCheckedChange={() =>
                toggle(hiddenCategories, setHiddenCategories, category.id)
              }
            />
            {category.name} {category.isSecret && '(secret)'}
          </label>
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="heading-sm">Hidden dish placements</h2>
          <Button size="sm" disabled={savingItems} onClick={() => saveItems([...hiddenItems])}>
            Save placements
          </Button>
        </div>
        {(categories ?? []).map((category) => (
          <div key={category.id} className="flex flex-col gap-2">
            <p className="text-body-sm font-medium">{category.name}</p>
            {category.items.map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-body-sm">
                <Checkbox
                  checked={hiddenItems.has(item.id)}
                  onCheckedChange={() => toggle(hiddenItems, setHiddenItems, item.id)}
                />
                {item.dish.name}
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
