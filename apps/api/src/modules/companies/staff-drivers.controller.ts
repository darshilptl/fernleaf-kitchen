import { Controller, Get } from '@nestjs/common';
import { RequirePermission } from '../auth/auth.decorator.js';
import { CompaniesService } from './companies.service.js';

/**
 * Minimal assignable-driver picker (plan §1.10 scope addition).
 * Lives in the companies module because only company setup
 * consumes it; the path matches the approved plan exactly.
 */
@Controller('staff')
export class StaffDriversController {
  constructor(private readonly companies: CompaniesService) {}

  @RequirePermission('companies.read')
  @Get('drivers')
  listDrivers() {
    return this.companies.listDrivers();
  }
}
