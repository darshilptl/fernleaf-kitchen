import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { forceCompleteSchema, kitchenBoardQuerySchema } from '@repo/shared';
import type { ForceCompleteInput, KitchenBoardQueryData } from '@repo/shared';
import { CurrentUser, RequirePermission } from '../auth/auth.decorator.js';
import type { RequestUser } from '../auth/auth.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { KitchenService } from './kitchen.service.js';

/**
 * Kitchen endpoints. PDF §4.7.
 *
 * `kitchen.read` opens the board; `kitchen.work` starts/finishes
 * units; `kitchen.force_complete` closes a whole order.
 */
@Controller('kitchen')
export class KitchenController {
  constructor(private readonly kitchen: KitchenService) {}

  @RequirePermission('kitchen.read')
  @Get('board')
  board(@Query(new ZodValidationPipe(kitchenBoardQuerySchema)) query: KitchenBoardQueryData) {
    return this.kitchen.board(query);
  }

  @RequirePermission('kitchen.work')
  @Post('units/:id/start')
  startUnit(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.kitchen.startUnit(id, user.id);
  }

  @RequirePermission('kitchen.work')
  @Post('units/:id/done')
  doneUnit(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.kitchen.doneUnit(id, user.id);
  }

  @RequirePermission('kitchen.force_complete')
  @Post('orders/:id/force-complete')
  forceComplete(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(forceCompleteSchema)) body: ForceCompleteInput,
  ) {
    return this.kitchen.forceComplete(id, user.id, body.version);
  }
}
