import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CatalogueController } from './catalogue.controller.js';
import { CatalogueService } from './catalogue.service.js';

@Module({
  controllers: [CatalogueController],
  providers: [CatalogueService, PrismaService],
  exports: [CatalogueService],
})
export class CatalogueModule {}
