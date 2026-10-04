import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  menuCategorySchema,
  menuPlacementSchema,
  menuPlacementUpdateSchema,
  menuPreviewQuerySchema,
  reorderSchema,
} from '@repo/shared';
import type {
  MenuCategoryInput,
  MenuPlacementInput,
  MenuPlacementUpdateInput,
  MenuPreviewQuery,
  ReorderInput,
} from '@repo/shared';
import { RequirePermission } from '../auth/auth.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { MenuService } from './menu.service.js';

/**
 * Menu endpoints (categories, placements, staff preview).
 * Reads and preview need `menu.read`; writes need `menu.manage`.
 */
@Controller('menu')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @RequirePermission('menu.read')
  @Get('categories')
  listCategories() {
    return this.menu.listCategories();
  }

  @RequirePermission('menu.manage')
  @Post('categories')
  createCategory(
    @Body(new ZodValidationPipe(menuCategorySchema)) body: MenuCategoryInput,
  ) {
    return this.menu.createCategory(body);
  }

  @RequirePermission('menu.manage')
  @Patch('categories/:id')
  updateCategory(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(menuCategorySchema)) body: MenuCategoryInput,
  ) {
    return this.menu.updateCategory(id, body);
  }

  @RequirePermission('menu.manage')
  @Post('categories/reorder')
  reorderCategories(@Body(new ZodValidationPipe(reorderSchema)) body: ReorderInput) {
    return this.menu.reorderCategories(body.ids);
  }

  @RequirePermission('menu.manage')
  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.menu.deleteCategory(id);
  }

  @RequirePermission('menu.manage')
  @Post('categories/:id/deactivate')
  deactivateCategory(@Param('id') id: string) {
    return this.menu.setCategoryActive(id, false);
  }

  @RequirePermission('menu.manage')
  @Post('categories/:id/activate')
  activateCategory(@Param('id') id: string) {
    return this.menu.setCategoryActive(id, true);
  }

  @RequirePermission('menu.manage')
  @Post('categories/:id/items')
  addPlacement(
    @Param('id') categoryId: string,
    @Body(new ZodValidationPipe(menuPlacementSchema)) body: MenuPlacementInput,
  ) {
    return this.menu.addPlacement(categoryId, body);
  }

  @RequirePermission('menu.manage')
  @Patch('items/:itemId')
  updatePlacement(
    @Param('itemId') itemId: string,
    @Body(new ZodValidationPipe(menuPlacementUpdateSchema)) body: MenuPlacementUpdateInput,
  ) {
    return this.menu.updatePlacement(itemId, body);
  }

  @RequirePermission('menu.manage')
  @Delete('items/:itemId')
  deletePlacement(@Param('itemId') itemId: string) {
    return this.menu.deletePlacement(itemId);
  }

  @RequirePermission('menu.read')
  @Get('preview')
  preview(@Query(new ZodValidationPipe(menuPreviewQuerySchema)) query: MenuPreviewQuery) {
    return this.menu.preview(query.employeeId, query.slug ?? null);
  }
}
