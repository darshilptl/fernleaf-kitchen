import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError } from '@repo/shared';
import type {
  DishInput,
  GroupOptionInput,
  OptionGroupInput,
  OptionInput,
  ReferenceItemInput,
} from '@repo/shared';
import { PrismaService } from '../../database/prisma.service.js';
import { assertNonBlank, assertNoPortions } from './domain/catalogue-validation.js';

export const REFERENCE_LISTS = [
  'allergens',
  'dietary-tags',
  'stations',
  'portion-sizes',
  'packaging-types',
] as const;

export type ReferenceList = (typeof REFERENCE_LISTS)[number];

export function parseReferenceList(value: string): ReferenceList {
  const found = (REFERENCE_LISTS as readonly string[]).find((entry) => entry === value);
  if (found === undefined) {
    throw new DomainError({
      code: 'VALIDATION_ERROR',
      path: 'list',
      message: `Unknown reference list: ${value}`,
      httpStatus: 400,
    });
  }
  return found as ReferenceList;
}

export interface ReferenceRow {
  id: string;
  name: string;
  sortOrder: number | null;
  isActive: boolean;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Catalogue Must-only store (dishes, options, groups, reference
 * lists). PDF §4.1. Deactivate, never hard-delete — except option
 * groups, which belong to one dish and are never snapshotted.
 * Portion writes are rejected up front (D: portions deferred).
 */
@Injectable()
export class CatalogueService {
  constructor(private readonly prisma: PrismaService) {}

  // ── reference lists ──────────────────────────────────────

  async listReference(list: ReferenceList, active?: boolean): Promise<ReferenceRow[]> {
    const where = active === undefined ? {} : { isActive: active };
    switch (list) {
      case 'allergens':
        return (await this.prisma.allergen.findMany({ where, orderBy: { name: 'asc' } })).map(
          toRow,
        );
      case 'dietary-tags':
        return (
          await this.prisma.dietaryTag.findMany({ where, orderBy: { name: 'asc' } })
        ).map(toRow);
      case 'stations':
        return (
          await this.prisma.kitchenStation.findMany({
            where,
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          })
        ).map(toRow);
      case 'portion-sizes':
        return (
          await this.prisma.portionSize.findMany({
            where,
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          })
        ).map(toRow);
      case 'packaging-types':
        return (
          await this.prisma.packagingType.findMany({
            where,
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          })
        ).map(toRow);
    }
  }

  async createReference(list: ReferenceList, input: ReferenceItemInput): Promise<ReferenceRow> {
    const name = input.name.trim();
    assertNonBlank(name, 'name');
    try {
      switch (list) {
        case 'allergens':
          return toRow(await this.prisma.allergen.create({ data: { name } }));
        case 'dietary-tags':
          return toRow(await this.prisma.dietaryTag.create({ data: { name } }));
        case 'stations':
          return toRow(
            await this.prisma.kitchenStation.create({
              data: { name, sortOrder: input.sortOrder ?? 0 },
            }),
          );
        case 'portion-sizes':
          return toRow(
            await this.prisma.portionSize.create({
              data: { name, sortOrder: input.sortOrder ?? 0 },
            }),
          );
        case 'packaging-types':
          return toRow(
            await this.prisma.packagingType.create({
              data: { name, sortOrder: input.sortOrder ?? 0 },
            }),
          );
      }
    } catch (error) {
      throw mapUniqueViolation(error, 'REFERENCE_DUPLICATE', 'Name is already used');
    }
  }

  async updateReference(
    list: ReferenceList,
    id: string,
    input: ReferenceItemInput,
  ): Promise<ReferenceRow> {
    const name = input.name.trim();
    assertNonBlank(name, 'name');
    try {
      switch (list) {
        case 'allergens':
          return toRow(
            await this.prisma.allergen.update({ where: { id }, data: { name } }),
          );
        case 'dietary-tags':
          return toRow(
            await this.prisma.dietaryTag.update({ where: { id }, data: { name } }),
          );
        case 'stations':
          return toRow(
            await this.prisma.kitchenStation.update({
              where: { id },
              data: { name, sortOrder: input.sortOrder ?? 0 },
            }),
          );
        case 'portion-sizes':
          return toRow(
            await this.prisma.portionSize.update({
              where: { id },
              data: { name, sortOrder: input.sortOrder ?? 0 },
            }),
          );
        case 'packaging-types':
          return toRow(
            await this.prisma.packagingType.update({
              where: { id },
              data: { name, sortOrder: input.sortOrder ?? 0 },
            }),
          );
      }
    } catch (error) {
      throw mapUniqueViolation(error, 'REFERENCE_DUPLICATE', 'Name is already used');
    }
  }

  async setReferenceActive(
    list: ReferenceList,
    id: string,
    isActive: boolean,
  ): Promise<ReferenceRow> {
    if (!isActive) {
      await this.assertDeactivatable(list, id);
    }
    switch (list) {
      case 'allergens':
        return toRow(await this.prisma.allergen.update({ where: { id }, data: { isActive } }));
      case 'dietary-tags':
        return toRow(await this.prisma.dietaryTag.update({ where: { id }, data: { isActive } }));
      case 'stations':
        return toRow(
          await this.prisma.kitchenStation.update({ where: { id }, data: { isActive } }),
        );
      case 'portion-sizes':
        return toRow(await this.prisma.portionSize.update({ where: { id }, data: { isActive } }));
      case 'packaging-types':
        return toRow(
          await this.prisma.packagingType.update({ where: { id }, data: { isActive } }),
        );
    }
  }

  private async assertDeactivatable(list: ReferenceList, id: string): Promise<void> {
    if (list === 'stations') {
      const inUse = await this.prisma.dish.findFirst({ where: { stationId: id, isActive: true } });
      if (inUse !== null) {
        throw new DomainError({
          code: 'REFERENCE_IN_USE',
          message: 'Station is used by an active dish',
          httpStatus: 409,
        });
      }
    }
    if (list === 'portion-sizes') {
      const inUse = await this.prisma.optionGroupPortion.findFirst({
        where: { portionSizeId: id },
      });
      if (inUse !== null) {
        throw new DomainError({
          code: 'REFERENCE_IN_USE',
          message: 'Portion size is sold by an option group',
          httpStatus: 409,
        });
      }
    }
  }

  // ── dishes ───────────────────────────────────────────────

  async listDishes(query: {
    page: number;
    pageSize: number;
    search: string;
    active?: boolean;
  }): Promise<PagedResult<{ id: string; name: string; sku: string; isActive: boolean }>> {
    const where = {
      ...(query.active === undefined ? {} : { isActive: query.active }),
      ...(query.search === ''
        ? {}
        : { OR: [{ name: { contains: query.search } }, { sku: { contains: query.search } }] }),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.dish.count({ where }),
      this.prisma.dish.findMany({
        where,
        select: { id: true, name: true, sku: true, isActive: true },
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async getDish(id: string): Promise<unknown> {
    const dish = await this.prisma.dish.findUnique({
      where: { id },
      include: {
        station: { select: { id: true, name: true } },
        allergens: { include: { allergen: { select: { id: true, name: true } } } },
        dietaryTags: { include: { tag: { select: { id: true, name: true } } } },
        optionGroups: {
          orderBy: { sortOrder: 'asc' },
          include: {
            options: {
              orderBy: { sortOrder: 'asc' },
              include: { option: { select: { id: true, name: true, isActive: true } } },
            },
          },
        },
      },
    });
    if (dish === null) {
      throw new DomainError({ code: 'DISH_NOT_FOUND', message: 'Dish not found', httpStatus: 404 });
    }
    return dish;
  }

  async createDish(input: DishInput): Promise<{ id: string }> {
    try {
      const name = input.name.trim();
      const sku = input.sku.trim();
      const dish = await this.prisma.dish.create({
        data: {
          name,
          description: input.description,
          imageUrl: input.imageUrl,
          sku,
          temperature: input.temperature,
          costCents: input.costCents,
          stationId: input.stationId,
          minOrderQuantity: input.minOrderQuantity,
          allergens: { create: (input.allergenIds ?? []).map((allergenId) => ({ allergenId })) },
          dietaryTags: { create: (input.dietaryTagIds ?? []).map((tagId) => ({ tagId })) },
        },
        select: { id: true },
      });
      return dish;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError({ code: 'SKU_TAKEN', message: 'SKU is already used', httpStatus: 409 });
      }
      throw mapMissingReference(error);
    }
  }

  async updateDish(id: string, input: DishInput): Promise<{ id: string }> {
    await this.requireDish(id);
    const name = input.name.trim();
    const sku = input.sku.trim();
    try {
      await this.prisma.dish.update({
        where: { id },
        data: {
          name,
          description: input.description,
          imageUrl: input.imageUrl,
          sku,
          temperature: input.temperature,
          costCents: input.costCents,
          stationId: input.stationId,
          minOrderQuantity: input.minOrderQuantity,
        },
      });
      return { id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError({ code: 'SKU_TAKEN', message: 'SKU is already used', httpStatus: 409 });
      }
      throw mapMissingReference(error);
    }
  }

  async setDishActive(id: string, isActive: boolean): Promise<{ id: string }> {
    await this.requireDish(id);
    await this.prisma.dish.update({ where: { id }, data: { isActive } });
    return { id };
  }

  private async requireDish(id: string): Promise<void> {
    const dish = await this.prisma.dish.findUnique({ where: { id }, select: { id: true } });
    if (dish === null) {
      throw new DomainError({ code: 'DISH_NOT_FOUND', message: 'Dish not found', httpStatus: 404 });
    }
  }

  // ── options ──────────────────────────────────────────────

  async listOptions(query: {
    page: number;
    pageSize: number;
    search: string;
    active?: boolean;
  }): Promise<PagedResult<{ id: string; name: string; isActive: boolean }>> {
    const where = {
      ...(query.active === undefined ? {} : { isActive: query.active }),
      ...(query.search === '' ? {} : { name: { contains: query.search } }),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.option.count({ where }),
      this.prisma.option.findMany({
        where,
        select: { id: true, name: true, isActive: true },
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async createOption(input: OptionInput): Promise<{ id: string }> {
    try {
      const option = await this.prisma.option.create({
        data: {
          name: input.name,
          description: input.description,
          costCents: input.costCents,
          allergens: { create: (input.allergenIds ?? []).map((allergenId) => ({ allergenId })) },
          dietaryTags: { create: (input.dietaryTagIds ?? []).map((tagId) => ({ tagId })) },
        },
        select: { id: true },
      });
      return option;
    } catch (error) {
      throw mapMissingReference(error);
    }
  }

  async updateOption(id: string, input: OptionInput): Promise<{ id: string }> {
    await this.requireOption(id);
    try {
      await this.prisma.option.update({
        where: { id },
        data: { name: input.name, description: input.description, costCents: input.costCents },
      });
      return { id };
    } catch (error) {
      throw mapMissingReference(error);
    }
  }

  async setOptionActive(id: string, isActive: boolean): Promise<{ id: string }> {
    await this.requireOption(id);
    await this.prisma.option.update({ where: { id }, data: { isActive } });
    return { id };
  }

  private async requireOption(id: string): Promise<void> {
    const option = await this.prisma.option.findUnique({ where: { id }, select: { id: true } });
    if (option === null) {
      throw new DomainError({
        code: 'OPTION_NOT_FOUND',
        message: 'Option not found',
        httpStatus: 404,
      });
    }
  }

  // ── option groups (belong to one dish; never snapshotted) ─

  async createGroup(
    dishId: string,
    rawBody: unknown,
    input: OptionGroupInput,
  ): Promise<{ id: string }> {
    assertNoPortions(rawBody);
    await this.requireDish(dishId);
    const group = await this.prisma.optionGroup.create({
      data: {
        dishId,
        name: input.name,
        isRequired: input.isRequired,
        sortOrder: input.sortOrder,
        usesPortions: false,
      },
      select: { id: true },
    });
    return group;
  }

  async updateGroup(
    groupId: string,
    rawBody: unknown,
    input: OptionGroupInput,
  ): Promise<{ id: string }> {
    assertNoPortions(rawBody);
    await this.requireGroup(groupId);
    await this.prisma.optionGroup.update({
      where: { id: groupId },
      data: { name: input.name, isRequired: input.isRequired, sortOrder: input.sortOrder },
    });
    return { id: groupId };
  }

  async deleteGroup(groupId: string): Promise<{ id: string }> {
    await this.requireGroup(groupId);
    await this.prisma.optionGroup.delete({ where: { id: groupId } });
    return { id: groupId };
  }

  async attachOption(groupId: string, input: GroupOptionInput): Promise<{ ok: true }> {
    await this.requireGroup(groupId);
    await this.requireOption(input.optionId);
    try {
      await this.prisma.optionGroupOption.create({
        data: { groupId, optionId: input.optionId, sortOrder: input.sortOrder },
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError({
          code: 'VALIDATION_ERROR',
          message: 'Option is already in this group',
          httpStatus: 409,
        });
      }
      throw error;
    }
  }

  async detachOption(groupId: string, optionId: string): Promise<{ ok: true }> {
    await this.prisma.optionGroupOption.deleteMany({ where: { groupId, optionId } });
    return { ok: true };
  }

  private async requireGroup(id: string): Promise<void> {
    const group = await this.prisma.optionGroup.findUnique({ where: { id }, select: { id: true } });
    if (group === null) {
      throw new DomainError({
        code: 'GROUP_NOT_FOUND',
        message: 'Option group not found',
        httpStatus: 404,
      });
    }
  }
}

interface RowLike {
  id: string;
  name: string;
  sortOrder?: number;
  isActive: boolean;
}

function toRow(row: RowLike): ReferenceRow {
  return { id: row.id, name: row.name, sortOrder: row.sortOrder ?? null, isActive: row.isActive };
}

function mapUniqueViolation(
  error: unknown,
  code: 'REFERENCE_DUPLICATE',
  message: string,
): DomainError {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return new DomainError({ code, message, httpStatus: 409 });
  }
  throw error;
}

function mapMissingReference(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
    return new DomainError({
      code: 'VALIDATION_ERROR',
      message: 'A referenced record does not exist',
      httpStatus: 400,
    });
  }
  return error;
}
