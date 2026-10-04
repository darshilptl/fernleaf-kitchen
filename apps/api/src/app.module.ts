import type { OnModuleInit } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaService } from './database/prisma.service.js';
import { HealthController } from './health/health.controller.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { PermissionGuard } from './modules/auth/guards/permission.guard.js';
import { ensureBaseData } from './modules/auth/base-data.js';

@Module({
  imports: [AuthModule],
  controllers: [HealthController],
  providers: [
    PrismaService,
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await ensureBaseData(this.prisma);
  }
}
