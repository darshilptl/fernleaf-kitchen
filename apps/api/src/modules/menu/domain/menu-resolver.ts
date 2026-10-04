import { resolveDishPrice, resolveOptionPrice } from '../../pricing/domain/resolve-price.js';
import type { PriceMaps } from '../../pricing/domain/resolve-price.js';

/**
 * Menu availability: the ONE function deciding what an employee
 * can order. PDF §4.2. Used by the staff preview, the order form,
 * and order validation at place time — no other code may decide
 * availability. The preview shows exactly this employee view.
 *
 * A dish is orderable ONLY IF ALL hold: active dish; >= 1 visible
 * placement (active item + active category, not company-hidden);
 * tier price > 0; every required group has >= 1 active, priced
 * option; portion invariant (vacuously true until portions land).
 * Without a slug, secret categories are excluded; with a slug,
 * only that category is returned (secret-link view), under every
 * other rule in both cases. Empty categories are omitted.
 */

export interface MenuOptionInput {
  id: string;
  name: string;
  isActive: boolean;
  costCents: number;
}

export interface MenuGroupInput {
  id: string;
  name: string;
  isRequired: boolean;
  sortOrder: number;
  options: MenuOptionInput[];
}

export interface MenuPlacementInput {
  itemId: string;
  itemSortOrder: number;
  itemIsActive: boolean;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  categorySortOrder: number;
  categoryIsActive: boolean;
  categoryIsSecret: boolean;
}

export interface MenuDishInput {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  temperature: string;
  minOrderQuantity: number | null;
  allergens: string[];
  dietaryTags: string[];
  costCents: number;
  placements: MenuPlacementInput[];
  groups: MenuGroupInput[];
}

export interface MenuResolverContext {
  tierId: string;
  maps: PriceMaps;
  hiddenCategoryIds: ReadonlySet<string>;
  hiddenItemIds: ReadonlySet<string>;
  secretSlug: string | null;
}

export interface MenuOptionView {
  id: string;
  name: string;
  priceCents: number;
}

export interface MenuGroupView {
  id: string;
  name: string;
  isRequired: boolean;
  options: MenuOptionView[];
}

export interface MenuItemView {
  itemId: string;
  dishId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  temperature: string;
  minOrderQuantity: number | null;
  allergens: string[];
  dietaryTags: string[];
  priceCents: number;
  groups: MenuGroupView[];
}

export interface MenuCategoryView {
  categoryId: string;
  name: string;
  slug: string;
  isSecret: boolean;
  items: MenuItemView[];
}

interface PlacedItem {
  categorySort: number;
  categoryName: string;
  itemSort: number;
  itemName: string;
  view: MenuItemView;
  categoryId: string;
  categorySlug: string;
  categoryIsSecret: boolean;
}

export function resolveMenu(
  dishes: MenuDishInput[],
  context: MenuResolverContext,
): MenuCategoryView[] {
  const placed: PlacedItem[] = [];
  for (const dish of dishes) {
    const price = resolveDishPrice(
      { id: dish.id, costCents: dish.costCents },
      context.tierId,
      context.maps,
    );
    if (price === null) {
      continue;
    }
    const groups = resolveGroups(dish, context);
    if (groups === null) {
      continue;
    }
    const item: Omit<MenuItemView, 'groups'> = {
      itemId: '',
      dishId: dish.id,
      name: dish.name,
      description: dish.description,
      imageUrl: dish.imageUrl,
      temperature: dish.temperature,
      minOrderQuantity: dish.minOrderQuantity,
      allergens: dish.allergens,
      dietaryTags: dish.dietaryTags,
      priceCents: price,
    };
    for (const placement of dish.placements) {
      if (!placement.itemIsActive || !placement.categoryIsActive) {
        continue;
      }
      if (context.hiddenCategoryIds.has(placement.categoryId)) {
        continue;
      }
      if (context.hiddenItemIds.has(placement.itemId)) {
        continue;
      }
      if (context.secretSlug !== null) {
        // Secret-link view (D-35): only the requested category, with
        // every other availability rule still applied below.
        if (placement.categorySlug !== context.secretSlug) {
          continue;
        }
      } else if (placement.categoryIsSecret) {
        continue;
      }
      placed.push({
        categorySort: placement.categorySortOrder,
        categoryName: placement.categoryName,
        itemSort: placement.itemSortOrder,
        itemName: dish.name,
        view: { ...item, itemId: placement.itemId, groups },
        categoryId: placement.categoryId,
        categorySlug: placement.categorySlug,
        categoryIsSecret: placement.categoryIsSecret,
      });
    }
  }
  placed.sort(
    (a, b) =>
      a.categorySort - b.categorySort ||
      a.categoryName.localeCompare(b.categoryName) ||
      a.itemSort - b.itemSort ||
      a.itemName.localeCompare(b.itemName),
  );
  const categories: MenuCategoryView[] = [];
  let current: MenuCategoryView | null = null;
  for (const entry of placed) {
    if (current === null || current.categoryId !== entry.categoryId) {
      current = {
        categoryId: entry.categoryId,
        name: entry.categoryName,
        slug: entry.categorySlug,
        isSecret: entry.categoryIsSecret,
        items: [],
      };
      categories.push(current);
    }
    current.items.push(entry.view);
  }
  return categories;
}

/**
 * Returns null when a required group has no selectable option
 * (dish hides); otherwise the group views with priced options.
 * Unpriced options are unselectable and omitted from the view.
 */
function resolveGroups(
  dish: MenuDishInput,
  context: MenuResolverContext,
): MenuGroupView[] | null {
  const views: MenuGroupView[] = [];
  const ordered = [...dish.groups].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const group of ordered) {
    const options: MenuOptionView[] = [];
    for (const option of group.options) {
      if (!option.isActive) {
        continue;
      }
      const price = resolveOptionPrice(
        { id: option.id, costCents: option.costCents },
        context.tierId,
        context.maps,
      );
      if (price === null) {
        continue;
      }
      options.push({ id: option.id, name: option.name, priceCents: price });
    }
    if (group.isRequired && options.length === 0) {
      return null;
    }
    views.push({ id: group.id, name: group.name, isRequired: group.isRequired, options });
  }
  return views;
}
