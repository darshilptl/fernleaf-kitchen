import { Controller, Get } from '@nestjs/common';
import { RequirePermission } from '../auth/auth.decorator.js';
import { DashboardsService } from './dashboards.service.js';

/**
 * Dashboard figures. PDF §4.11. Server-computed aggregates;
 * the browser only renders. Admin figures need `billing.read`
 * (kitchen/dispatch/driver roles do not hold it).
 */
@Controller('dashboards')
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  @RequirePermission('billing.read')
  @Get('admin')
  adminFigures() {
    return this.dashboards.adminFigures();
  }
}
