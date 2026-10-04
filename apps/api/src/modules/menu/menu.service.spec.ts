import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service.js';
import { requireTestDatabaseUrl, truncateAll, createTestCompany } from '../../../test/db.js';
import { CatalogueService } from '../catalogue/catalogue.service.js';
import { CompaniesService } from '../companies/companies.service.js';
import { EmployeesService } from '../employees/employees.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import { resolveMenu } from './domain/menu-resolver.js';
import type { MenuDishInput, MenuResolverContext } from './domain/menu-resolver.js';
import type { PriceMaps } from '../pricing/domain/resolve-price.js';
import { MenuService } from './menu.service.js';

/**
 * Menu availability and staff preview. PDF §4.2.
 * Fixtures go through the real catalogue/companies/employees/
 * pricing services; the resolver is pure and fed by hand-built
 * payloads for rule-level tests.
 */

const EMPTY_MAPS: PriceMaps = {
  tiers: new Map(),
  dishPrices: new Map(),
  optionPrices: new Map(),
};

function dishFixture(overrides?: Partial<MenuDishInput>): MenuDishInput {
  return {
    id: 'dish-1',
    name: 'Bowl',
    description: null,
    imageUrl: null,
    temperature: 'HOT',
    minOrderQuantity: null,
    allergens: [],
    dietaryTags: [],
    costCents: 300,
    placements: [
      {
        itemId: 'item-1',
        itemSortOrder: 0,
        itemIsActive: true,
        categoryId: 'cat-1',
        categoryName: 'Bowls',
        categorySlug: 'bowls',
        categorySortOrder: 0,
        categoryIsActive: true,
        categoryIsSecret: false,
      },
    ],
    groups: [],
    ...overrides,
  };
}

function contextFixture(overrides?: Partial<MenuResolverContext>): MenuResolverContext {
  return {
    tierId: 'tier-1',
    maps: EMPTY_MAPS,
    hiddenCategoryIds: new Set<string>(),
    hiddenItemIds: new Set<string>(),
    secretSlug: null,
    ...overrides,
  };
}

describe('resolveMenu', () => {
  it('hides dishes with no tier price', () => {
    const categories = resolveMenu([dishFixture()], contextFixture());
    expect(categories).toHaveLength(0);
  });

  it('shows priced dishes with groups and sorted output', () => {
    const maps: PriceMaps = {
      ...EMPTY_MAPS,
      dishPrices: new Map([['tier-1:dish-1', 500]]),
      optionPrices: new Map([['tier-1:opt-1', 100]]),
    };
    const dish = dishFixture({
      groups: [
        {
          id: 'group-1',
          name: 'Protein',
          isRequired: true,
          sortOrder: 0,
          options: [{ id: 'opt-1', name: 'Paneer', isActive: true, costCents: 100 }],
        },
      ],
    });
    const categories = resolveMenu([dish], contextFixture({ maps }));
    expect(categories).toHaveLength(1);
    expect(categories[0]?.items[0]?.priceCents).toBe(500);
    expect(categories[0]?.items[0]?.groups[0]?.options).toHaveLength(1);
  });

  it('hides dishes whose required group has no priced option', () => {
    const maps: PriceMaps = {
      ...EMPTY_MAPS,
      dishPrices: new Map([['tier-1:dish-1', 500]]),
    };
    const dish = dishFixture({
      groups: [
        {
          id: 'group-1',
          name: 'Protein',
          isRequired: true,
          sortOrder: 0,
          options: [{ id: 'opt-1', name: 'Paneer', isActive: true, costCents: 100 }],
        },
      ],
    });
    expect(resolveMenu([dish], contextFixture({ maps }))).toHaveLength(0);
  });

  it('hides company-hidden categories and items', () => {
    const maps: PriceMaps = {
      ...EMPTY_MAPS,
      dishPrices: new Map([['tier-1:dish-1', 500]]),
    };
    const dish = dishFixture();
    expect(
      resolveMenu([dish], contextFixture({ maps, hiddenCategoryIds: new Set(['cat-1']) })),
    ).toHaveLength(0);
    expect(
      resolveMenu([dish], contextFixture({ maps, hiddenItemIds: new Set(['item-1']) })),
    ).toHaveLength(0);
  });

  it('excludes secret categories unless requested by slug', () => {
    const maps: PriceMaps = {
      ...EMPTY_MAPS,
      dishPrices: new Map([['tier-1:dish-1', 500]]),
    };
    const secret = dishFixture({
      placements: [
        {
          itemId: 'item-9',
          itemSortOrder: 0,
          itemIsActive: true,
          categoryId: 'cat-9',
          categoryName: 'Secret',
          categorySlug: 'secret',
          categorySortOrder: 0,
          categoryIsActive: true,
          categoryIsSecret: true,
        },
      ],
    });
    expect(resolveMenu([secret], contextFixture({ maps }))).toHaveLength(0);
    const shown = resolveMenu([secret], contextFixture({ maps, secretSlug: 'secret' }));
    expect(shown).toHaveLength(1);
    expect(shown[0]?.isSecret).toBe(true);
  });

  it('omits empty categories and shows multi-placed dishes twice', () => {
    const maps: PriceMaps = {
      ...EMPTY_MAPS,
      dishPrices: new Map([['tier-1:dish-1', 500]]),
    };
    const dish = dishFixture({
      placements: [
        {
          itemId: 'item-1',
          itemSortOrder: 0,
          itemIsActive: true,
          categoryId: 'cat-1',
          categoryName: 'Bowls',
          categorySlug: 'bowls',
          categorySortOrder: 0,
          categoryIsActive: true,
          categoryIsSecret: false,
        },
        {
          itemId: 'item-2',
          itemSortOrder: 0,
          itemIsActive: true,
          categoryId: 'cat-2',
          categoryName: 'Lunch',
          categorySlug: 'lunch',
          categorySortOrder: 1,
          categoryIsActive: true,
          categoryIsSecret: false,
        },
      ],
    });
    const categories = resolveMenu([dish], contextFixture({ maps }));
    expect(categories).toHaveLength(2);
    expect(categories[0]?.name).toBe('Bowls');
    expect(categories[1]?.name).toBe('Lunch');
  });
});

describe('MenuService', () => {
  const prisma = new PrismaService(requireTestDatabaseUrl());
  const catalogue = new CatalogueService(prisma);
  const companies = new CompaniesService(prisma);
  const employees = new EmployeesService(prisma);
  const pricing = new PricingService(prisma);
  const menu = new MenuService(prisma, pricing);

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function fixture(): Promise<{ employeeId: string; dishId: string; categoryId: string }> {
    const company = await createTestCompany(prisma);
    const staff = await employees.createEmployee(company.id, {
      name: 'Eve',
      email: 'eve@acme.test',
      canChooseAddress: false,
      canChangeDeliveryTime: false,
      canChangePackaging: false,
      allergenIds: [],
      dietaryTagIds: [],
    });
    const tier = await pricing.createTier({ name: 'Standard' });
    await companies.setTier(company.id, tier.id);
    const dish = await catalogue.createDish({
      name: 'Bowl',
      description: null,
      imageUrl: null,
      sku: 'MENU-1',
      temperature: 'HOT',
      costCents: 300,
      stationId: null,
      minOrderQuantity: null,
      allergenIds: [],
      dietaryTagIds: [],
    });
    await pricing.saveBatchPrices(tier.id, {
      dishPrices: [{ itemId: dish.id, priceCents: 500 }],
      optionPrices: [],
    });
    const category = await menu.createCategory({
      name: 'Bowls',
      slug: null,
      description: null,
      sortOrder: 0,
      isSecret: false,
    });
    await menu.addPlacement(category.id, { dishId: dish.id, sortOrder: 0 });
    return { employeeId: staff.id, dishId: dish.id, categoryId: category.id };
  }

  it('deactivates and reactivates a category, 404 on unknown', async () => {
    const category = await menu.createCategory({
      name: 'Seasonal',
      slug: null,
      description: null,
      sortOrder: 5,
      isSecret: false,
    });
    await menu.setCategoryActive(category.id, false);
    const hidden = await prisma.menuCategory.findUniqueOrThrow({ where: { id: category.id } });
    expect(hidden.isActive).toBe(false);
    await menu.setCategoryActive(category.id, true);
    const shown = await prisma.menuCategory.findUniqueOrThrow({ where: { id: category.id } });
    expect(shown.isActive).toBe(true);
    await expect(
      menu.setCategoryActive('00000000-0000-0000-0000-000000000000', false),
    ).rejects.toMatchObject({ code: 'MENU_NOT_FOUND' });
  });

  it('previews exactly the employee view with banner data', async () => {    const { employeeId } = await fixture();
    const preview = await menu.preview(employeeId, null);
    expect(preview.banner).toBeNull();
    expect(preview.categories).toHaveLength(1);
    const item = preview.categories[0]?.items[0];
    expect(item?.priceCents).toBe(500);
    expect(item).not.toHaveProperty('costCents');
    expect(item).not.toHaveProperty('sku');
  });

  it('reorders atomically and rejects partial id sets', async () => {
    const first = await menu.createCategory({
      name: 'A',
      slug: null,
      description: null,
      sortOrder: 0,
      isSecret: false,
    });
    const second = await menu.createCategory({
      name: 'B',
      slug: null,
      description: null,
      sortOrder: 1,
      isSecret: false,
    });
    await menu.reorderCategories([second.id, first.id]);
    const ordered = await prisma.menuCategory.findMany({ orderBy: { sortOrder: 'asc' } });
    expect(ordered.map((row) => row.id)).toEqual([second.id, first.id]);
    await expect(menu.reorderCategories([first.id])).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('hard-deletes categories and items while dishes only deactivate', async () => {
    const { dishId, categoryId } = await fixture();
    const item = await prisma.menuItem.findFirstOrThrow({ where: { categoryId } });
    await menu.deletePlacement(item.id);
    expect(await prisma.menuItem.findUnique({ where: { id: item.id } })).toBeNull();
    await menu.deleteCategory(categoryId);
    expect(await prisma.menuCategory.findUnique({ where: { id: categoryId } })).toBeNull();
    expect(await prisma.dish.findUnique({ where: { id: dishId } })).not.toBeNull();
  });
});
