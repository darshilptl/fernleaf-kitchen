import type { OnModuleInit } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaService } from './database/prisma.service.js';
import { HealthController } from './health/health.controller.js';
import { LoggingInterceptor } from './common/logging/logging.interceptor.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogueModule } from './modules/catalogue/catalogue.module.js';
import { CompaniesModule } from './modules/companies/companies.module.js';
import { EmployeesModule } from './modules/employees/employees.module.js';
import { MenuModule } from './modules/menu/menu.module.js';
import { PricingModule } from './modules/pricing/pricing.module.js';
import { StaffModule } from './modules/staff/staff.module.js';
import { PermissionGuard } from './modules/auth/guards/permission.guard.js';
import { ensureBaseData } from './modules/auth/base-data.js';

@Module({
  imports: [AuthModule, CatalogueModule, CompaniesModule, EmployeesModule, MenuModule, PricingModule, StaffModule],
  controllers: [HealthController],
  providers: [
    PrismaService,
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await ensureBaseData(this.prisma);
  }
}
