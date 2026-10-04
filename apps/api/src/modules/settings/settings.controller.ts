import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { kitchenHolidaySchema, settingsSchema } from '@repo/shared';
import type { KitchenHolidayInput, SettingsInput } from '@repo/shared';
import { RequirePermission } from '../auth/auth.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { SettingsService } from './settings.service.js';

/**
 * Platform settings and kitchen holidays. PDF §4.10.
 * Reads need `settings.read`; writes need `settings.manage`.
 */
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @RequirePermission('settings.read')
  @Get()
  getSettings() {
    return this.settings.getSettings();
  }

  @RequirePermission('settings.manage')
  @Patch()
  updateSettings(@Body(new ZodValidationPipe(settingsSchema)) body: SettingsInput) {
    return this.settings.updateSettings(body);
  }

  @RequirePermission('settings.read')
  @Get('holidays')
  listHolidays() {
    return this.settings.listHolidays();
  }

  @RequirePermission('settings.manage')
  @Post('holidays')
  addHoliday(@Body(new ZodValidationPipe(kitchenHolidaySchema)) body: KitchenHolidayInput) {
    return this.settings.addHoliday(body);
  }

  @RequirePermission('settings.manage')
  @Delete('holidays/:id')
  removeHoliday(@Param('id') id: string) {
    return this.settings.removeHoliday(id);
  }
}
