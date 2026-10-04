import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, PrismaService],
  exports: [SettingsService],
})
export class SettingsModule {}
