import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError } from '@repo/shared';
import type { MenuCategoryInput, MenuPlacementInput, MenuPlacementUpdateInput } from '@repo/shared';
import { PrismaService } from '../../database/prisma.service.js';
import { logAction } from '../../common/logging/logging.interceptor.js';
import { PricingService } from '../pricing/pricing.service.js';
import { resolveMenu } from './domain/menu-resolver.js';
import type { MenuCategoryView, MenuDishInput } from './domain/menu-resolver.js';

export interface MenuPreview {
  categories: MenuCategoryView[];
  banner: string | null;
}

/**
 * Menu categories, dish placements, and the staff preview.
 * PDF §4.2. Categories and items may be hard-deleted (orders
 * never reference them); dishes themselves only deactivate.
 * Availability is decided solely by `resolveMenu`.
 */
@Injectable()
export class MenuService {
  private readonly logger = new Logger(MenuService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  async listCategories(): Promise<unknown[]> {
    return this.prisma.menuCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { items: true } },
        items: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            sortOrder: true,
            isActive: true,
            dish: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async createCategory(input: MenuCategoryInput): Promise<{ id: string }> {
    const slug = await this.uniqueSlug(slugify(input.slug ?? input.name), null);
    const category = await this.prisma.menuCategory.create({
      data: {
        name: input.name.trim(),
        slug,
        description: input.description,
        sortOrder: input.sortOrder ?? 0,
        isSecret: input.isSecret ?? false,
      },
      select: { id: true },
    });
    logAction(this.logger, 'menu.create-category', { categoryId: category.id });
    return category;
  }

  async updateCategory(id: string, input: MenuCategoryInput): Promise<{ id: string }> {
    await this.requireCategory(id);
    await this.prisma.menuCategory.update({
      where: { id },
      data: {
        name: input.name.trim(),
        description: input.description,
        sortOrder: input.sortOrder ?? 0,
        isSecret: input.isSecret ?? false,
      },
    });
    logAction(this.logger, 'menu.update-category', { categoryId: id });
    return { id };
  }

  async reorderCategories(ids: string[]): Promise<{ ok: true }> {
    const existing = await this.prisma.menuCategory.findMany({ select: { id: true } });
    const known = new Set(existing.map((row) => row.id));
    if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
      throw new DomainError({
        code: 'VALIDATION_ERROR',
        message: 'Reorder must list every category exactly once',
        httpStatus: 400,
      });
    }
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.menuCategory.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    logAction(this.logger, 'menu.reorder-categories', { count: ids.length });
    return { ok: true };
  }

  async deleteCategory(id: string): Promise<{ id: string }> {
    await this.requireCategory(id);
    await this.prisma.menuCategory.delete({ where: { id } });
    logAction(this.logger, 'menu.delete-category', { categoryId: id });
    return { id };
  }

  async setCategoryActive(id: string, isActive: boolean): Promise<{ id: string }> {
    await this.requireCategory(id);
    await this.prisma.menuCategory.update({ where: { id }, data: { isActive } });
    logAction(this.logger, isActive ? 'menu.activate-category' : 'menu.deactivate-category', {
      categoryId: id,
    });
    return { id };
  }

  async addPlacement(
    categoryId: string,
    input: MenuPlacementInput,
  ): Promise<{ id: string }> {
    await this.requireCategory(categoryId);
    const dish = await this.prisma.dish.findUnique({ where: { id: input.dishId } });
    if (dish === null) {
      throw new DomainError({ code: 'DISH_NOT_FOUND', message: 'Dish not found', httpStatus: 404 });
    }
    try {
      const item = await this.prisma.menuItem.create({
        data: {
          categoryId,
          dishId: input.dishId,
          sortOrder: input.sortOrder ?? 0,
        },
        select: { id: true },
      });
      logAction(this.logger, 'menu.add-placement', { categoryId, itemId: item.id });
      return item;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError({
          code: 'VALIDATION_ERROR',
          message: 'Dish is already in this category',
          httpStatus: 409,
        });
      }
      throw error;
    }
  }

  async updatePlacement(itemId: string, input: MenuPlacementUpdateInput): Promise<{ id: string }> {
    await this.requireItem(itemId);
    await this.prisma.menuItem.update({
      where: { id: itemId },
      data: {
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    logAction(this.logger, 'menu.update-placement', { itemId });
    return { id: itemId };
  }

  async deletePlacement(itemId: string): Promise<{ id: string }> {
    await this.requireItem(itemId);
    await this.prisma.menuItem.delete({ where: { id: itemId } });
    logAction(this.logger, 'menu.delete-placement', { itemId });
    return { id: itemId };
  }

  async preview(employeeId: string, slug: string | null): Promise<MenuPreview> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        company: {
          include: {
            hiddenCategories: { select: { categoryId: true } },
            hiddenItems: { select: { menuItemId: true } },
          },
        },
      },
    });
    if (employee === null) {
      throw new DomainError({
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'Employee not found',
        httpStatus: 404,
      });
    }
    const tierId = await this.pricing.resolveEmployeeTierId(employee.company.priceTierId);
    const { maps } = await this.pricing.loadPriceMaps(tierId);
    const dishes = await this.prisma.dish.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        temperature: true,
        minOrderQuantity: true,
        costCents: true,
        allergens: { select: { allergen: { select: { name: true } } } },
        dietaryTags: { select: { tag: { select: { name: true } } } },
        menuItems: {
          select: {
            id: true,
            sortOrder: true,
            isActive: true,
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                sortOrder: true,
                isActive: true,
                isSecret: true,
              },
            },
          },
        },
        optionGroups: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            isRequired: true,
            sortOrder: true,
            options: {
              orderBy: { sortOrder: 'asc' },
              select: {
                option: {
                  select: { id: true, name: true, isActive: true, costCents: true },
                },
              },
            },
          },
        },
      },
    });
    const inputs: MenuDishInput[] = dishes.map((dish) => ({
      id: dish.id,
      name: dish.name,
      description: dish.description,
      imageUrl: dish.imageUrl,
      temperature: dish.temperature,
      minOrderQuantity: dish.minOrderQuantity,
      allergens: dish.allergens.map((row) => row.allergen.name),
      dietaryTags: dish.dietaryTags.map((row) => row.tag.name),
      costCents: dish.costCents,
      placements: dish.menuItems.map((item) => ({
        itemId: item.id,
        itemSortOrder: item.sortOrder,
        itemIsActive: item.isActive,
        categoryId: item.category.id,
        categoryName: item.category.name,
        categorySlug: item.category.slug,
        categorySortOrder: item.category.sortOrder,
        categoryIsActive: item.category.isActive,
        categoryIsSecret: item.category.isSecret,
      })),
      groups: dish.optionGroups.map((group) => ({
        id: group.id,
        name: group.name,
        isRequired: group.isRequired,
        sortOrder: group.sortOrder,
        options: group.options.map((link) => ({
          id: link.option.id,
          name: link.option.name,
          isActive: link.option.isActive,
          costCents: link.option.costCents,
        })),
      })),
    }));
    const categories = resolveMenu(
      inputs,
      {
        tierId,
        maps,
        hiddenCategoryIds: new Set(employee.company.hiddenCategories.map((row) => row.categoryId)),
        hiddenItemIds: new Set(employee.company.hiddenItems.map((row) => row.menuItemId)),
        secretSlug: slug,
      },
    );
    const banner =
      !employee.isActive || !employee.company.isActive
        ? 'Previewing as an inactive employee or company'
        : null;
    return { categories, banner };
  }

  private async uniqueSlug(base: string, selfId: string | null): Promise<string> {
    let candidate = base === '' ? 'category' : base;
    let suffix = 2;
    for (;;) {
      const clash = await this.prisma.menuCategory.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (clash === null || clash.id === selfId) {
        return candidate;
      }
      candidate = `${base === '' ? 'category' : base}-${suffix}`;
      suffix += 1;
    }
  }

  private async requireCategory(id: string): Promise<void> {
    const category = await this.prisma.menuCategory.findUnique({
      where: { id },
      select: { id: true },
    });
    if (category === null) {
      throw new DomainError({
        code: 'MENU_NOT_FOUND',
        message: 'Menu category not found',
        httpStatus: 404,
      });
    }
  }

  private async requireItem(id: string): Promise<void> {
    const item = await this.prisma.menuItem.findUnique({ where: { id }, select: { id: true } });
    if (item === null) {
      throw new DomainError({
        code: 'MENU_NOT_FOUND',
        message: 'Menu item not found',
        httpStatus: 404,
      });
    }
  }
}

function slugify(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug;
}
