import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { changeRoleSchema, createStaffSchema, staffListQuerySchema } from '@repo/shared';
import type { ChangeRoleInput, CreateStaffInput, StaffListQueryData } from '@repo/shared';
import { CurrentUser, RequirePermission } from '../auth/auth.decorator.js';
import type { RequestUser } from '../auth/auth.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { StaffService } from './staff.service.js';

/**
 * Staff account endpoints. Every route needs `staff.manage`.
 * Responses never include password hashes.
 */
@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @RequirePermission('staff.manage')
  @Get()
  listStaff(@Query(new ZodValidationPipe(staffListQuerySchema)) query: StaffListQueryData) {
    return this.staff.listStaff(query.page, query.pageSize);
  }

  @RequirePermission('staff.manage')
  @Get('roles')
  listRoles() {
    return this.staff.listRoles();
  }

  @RequirePermission('staff.manage')
  @Post()
  createStaff(@Body(new ZodValidationPipe(createStaffSchema)) body: CreateStaffInput) {
    return this.staff.createStaff(body);
  }

  @RequirePermission('staff.manage')
  @Patch(':id/role')
  changeRole(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(changeRoleSchema)) body: ChangeRoleInput,
  ) {
    return this.staff.changeRole(id, body);
  }

  @RequirePermission('staff.manage')
  @Post(':id/deactivate')
  deactivateStaff(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.staff.setStaffActive(id, false, user.id);
  }

  @RequirePermission('staff.manage')
  @Post(':id/activate')
  activateStaff(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.staff.setStaffActive(id, true, user.id);
  }
}
