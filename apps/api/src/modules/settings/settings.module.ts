import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { DemoDataModule } from '../demo-data/demo-data.module.js';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

@Module({
  imports: [DemoDataModule],
  controllers: [SettingsController],
  providers: [SettingsService, PrismaService],
  exports: [SettingsService],
})
export class SettingsModule {}
