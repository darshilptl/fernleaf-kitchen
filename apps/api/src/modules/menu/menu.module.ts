import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { MenuController } from './menu.controller.js';
import { MenuService } from './menu.service.js';

@Module({
  imports: [PricingModule],
  controllers: [MenuController],
  providers: [MenuService, PrismaService],
  exports: [MenuService],
})
export class MenuModule {}
