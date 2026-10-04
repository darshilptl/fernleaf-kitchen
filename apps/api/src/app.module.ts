import type { OnModuleInit } from '@nestjs/common';
import { Logger, Module } from '@nestjs/common';
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
import { SettingsModule } from './modules/settings/settings.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PermissionGuard } from './modules/auth/guards/permission.guard.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { DispatchModule } from './modules/dispatch/dispatch.module.js';
import { KitchenModule } from './modules/kitchen/kitchen.module.js';
import { DashboardsModule } from './modules/dashboards/dashboards.module.js';
import { ensureBaseData } from './modules/auth/base-data.js';
import { seedPart2 } from '../prisma/seed/part-2.js';

@Module({
  imports: [AuthModule, CatalogueModule, CompaniesModule, EmployeesModule, MenuModule, PricingModule, StaffModule, SettingsModule, OrdersModule, KitchenModule, DispatchModule, BillingModule, DashboardsModule],
  controllers: [HealthController],
  providers: [
    PrismaService,
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await ensureBaseData(this.prisma);
    // Boot must never crash serving: demo seeding is best-effort here
    // (the admin refresh action retries it); failures log loudly.
    try {
      await seedPart2(this.prisma);
    } catch (error) {
      this.logger.error('Demo seed failed on boot', error instanceof Error ? error.stack : undefined);
    }
  }
}
