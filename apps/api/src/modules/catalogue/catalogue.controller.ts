import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  dishSchema,
  groupOptionSchema,
  optionGroupSchema,
  optionSchema,
  paginationSchema,
  referenceItemSchema,
} from '@repo/shared';
import type {
  DishInput,
  GroupOptionInput,
  OptionGroupInput,
  OptionInput,
  ReferenceItemInput,
} from '@repo/shared';
import { RequirePermission } from '../auth/auth.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CatalogueService, parseReferenceList } from './catalogue.service.js';

/**
 * Catalogue endpoints (dishes, options, groups, reference lists).
 * Reads need `catalogue.read`; every write needs `catalogue.manage`.
 * The server resolves all names/prices; the client never sends them.
 */
@Controller()
export class CatalogueController {
  constructor(private readonly catalogue: CatalogueService) {}

  @RequirePermission('catalogue.read')
  @Get('reference/:list')
  listReference(@Param('list') list: string) {
    return this.catalogue.listReference(parseReferenceList(list));
  }

  @RequirePermission('catalogue.manage')
  @Post('reference/:list')
  createReference(
    @Param('list') list: string,
    @Body(new ZodValidationPipe(referenceItemSchema)) body: ReferenceItemInput,
  ) {
    return this.catalogue.createReference(parseReferenceList(list), body);
  }

  @RequirePermission('catalogue.manage')
  @Patch('reference/:list/:id')
  updateReference(
    @Param('list') list: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(referenceItemSchema)) body: ReferenceItemInput,
  ) {
    return this.catalogue.updateReference(parseReferenceList(list), id, body);
  }

  @RequirePermission('catalogue.manage')
  @Post('reference/:list/:id/deactivate')
  deactivateReference(@Param('list') list: string, @Param('id') id: string) {
    return this.catalogue.setReferenceActive(parseReferenceList(list), id, false);
  }

  @RequirePermission('catalogue.manage')
  @Post('reference/:list/:id/activate')
  activateReference(@Param('list') list: string, @Param('id') id: string) {
    return this.catalogue.setReferenceActive(parseReferenceList(list), id, true);
  }

  @RequirePermission('catalogue.read')
  @Get('dishes')
  listDishes(@Query(new ZodValidationPipe(paginationSchema)) query: { page: number; pageSize: number }) {
    return this.catalogue.listDishes({ ...query, search: '' });
  }

  @RequirePermission('catalogue.read')
  @Get('dishes/:id')
  getDish(@Param('id') id: string) {
    return this.catalogue.getDish(id);
  }

  @RequirePermission('catalogue.manage')
  @Post('dishes')
  createDish(@Body(new ZodValidationPipe(dishSchema)) body: DishInput) {
    return this.catalogue.createDish(body);
  }

  @RequirePermission('catalogue.manage')
  @Patch('dishes/:id')
  updateDish(@Param('id') id: string, @Body(new ZodValidationPipe(dishSchema)) body: DishInput) {
    return this.catalogue.updateDish(id, body);
  }

  @RequirePermission('catalogue.manage')
  @Post('dishes/:id/deactivate')
  deactivateDish(@Param('id') id: string) {
    return this.catalogue.setDishActive(id, false);
  }

  @RequirePermission('catalogue.manage')
  @Post('dishes/:id/activate')
  activateDish(@Param('id') id: string) {
    return this.catalogue.setDishActive(id, true);
  }

  @RequirePermission('catalogue.read')
  @Get('options')
  listOptions(
    @Query(new ZodValidationPipe(paginationSchema)) query: { page: number; pageSize: number },
  ) {
    return this.catalogue.listOptions({ ...query, search: '' });
  }

  @RequirePermission('catalogue.manage')
  @Post('options')
  createOption(@Body(new ZodValidationPipe(optionSchema)) body: OptionInput) {
    return this.catalogue.createOption(body);
  }

  @RequirePermission('catalogue.manage')
  @Patch('options/:id')
  updateOption(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(optionSchema)) body: OptionInput,
  ) {
    return this.catalogue.updateOption(id, body);
  }

  @RequirePermission('catalogue.manage')
  @Post('options/:id/deactivate')
  deactivateOption(@Param('id') id: string) {
    return this.catalogue.setOptionActive(id, false);
  }

  @RequirePermission('catalogue.manage')
  @Post('options/:id/activate')
  activateOption(@Param('id') id: string) {
    return this.catalogue.setOptionActive(id, true);
  }

  @RequirePermission('catalogue.manage')
  @Post('dishes/:id/groups')
  createGroup(
    @Param('id') dishId: string,
    @Body() rawBody: unknown,
    @Body(new ZodValidationPipe(optionGroupSchema)) body: OptionGroupInput,
  ) {
    return this.catalogue.createGroup(dishId, rawBody, body);
  }

  @RequirePermission('catalogue.manage')
  @Patch('groups/:groupId')
  updateGroup(
    @Param('groupId') groupId: string,
    @Body() rawBody: unknown,
    @Body(new ZodValidationPipe(optionGroupSchema)) body: OptionGroupInput,
  ) {
    return this.catalogue.updateGroup(groupId, rawBody, body);
  }

  @RequirePermission('catalogue.manage')
  @Delete('groups/:groupId')
  deleteGroup(@Param('groupId') groupId: string) {
    return this.catalogue.deleteGroup(groupId);
  }

  @RequirePermission('catalogue.manage')
  @Post('groups/:groupId/options')
  attachOption(
    @Param('groupId') groupId: string,
    @Body(new ZodValidationPipe(groupOptionSchema)) body: GroupOptionInput,
  ) {
    return this.catalogue.attachOption(groupId, body);
  }

  @RequirePermission('catalogue.manage')
  @Delete('groups/:groupId/options/:optionId')
  detachOption(@Param('groupId') groupId: string, @Param('optionId') optionId: string) {
    return this.catalogue.detachOption(groupId, optionId);
  }
}
