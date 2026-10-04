import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import {
  addressSchema,
  companyListQuerySchema,
  companyTierSchema,
  createCompanySchema,
  domainSchema,
  hiddenSetSchema,
  holidaySchema,
  setOwnerSchema,
  updateCompanySchema,
} from '@repo/shared';
import type {
  AddressInput,
  CompanyListQueryData,
  CompanyTierInput,
  CreateCompanyInput,
  DomainInput,
  HiddenSetInput,
  HolidayInput,
  SetOwnerInput,
  UpdateCompanyInput,
} from '@repo/shared';
import { RequirePermission } from '../auth/auth.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CompaniesService } from './companies.service.js';

/**
 * Company endpoints. Reads need `companies.read`; every write
 * needs `companies.manage`. Creation also creates the owner
 * employee in the same transaction.
 */
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @RequirePermission('companies.read')
  @Get()
  listCompanies(
    @Query(new ZodValidationPipe(companyListQuerySchema)) query: CompanyListQueryData,
  ) {
    return this.companies.listCompanies({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      active: query.active,
    });
  }

  @RequirePermission('companies.manage')
  @Post()
  createCompany(@Body(new ZodValidationPipe(createCompanySchema)) body: CreateCompanyInput) {
    return this.companies.createCompany(body);
  }

  @RequirePermission('companies.read')
  @Get(':id')
  getCompany(@Param('id') id: string) {
    return this.companies.getCompany(id);
  }

  @RequirePermission('companies.manage')
  @Patch(':id')
  updateCompany(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCompanySchema)) body: UpdateCompanyInput,
  ) {
    return this.companies.updateCompany(id, body);
  }

  @RequirePermission('companies.manage')
  @Post(':id/deactivate')
  deactivateCompany(@Param('id') id: string) {
    return this.companies.setCompanyActive(id, false);
  }

  @RequirePermission('companies.manage')
  @Post(':id/activate')
  activateCompany(@Param('id') id: string) {
    return this.companies.setCompanyActive(id, true);
  }

  @RequirePermission('companies.manage')
  @Put(':id/owner')
  setOwner(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setOwnerSchema)) body: SetOwnerInput,
  ) {
    return this.companies.setOwner(id, body.employeeId);
  }

  @RequirePermission('companies.manage')
  @Post(':id/addresses')
  addAddress(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addressSchema)) body: AddressInput,
  ) {
    return this.companies.addAddress(id, body);
  }

  @RequirePermission('companies.manage')
  @Post(':id/addresses/:addressId/make-default')
  makeDefaultAddress(@Param('id') id: string, @Param('addressId') addressId: string) {
    return this.companies.makeDefaultAddress(id, addressId);
  }

  @RequirePermission('companies.manage')
  @Post(':id/domains')
  addDomain(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(domainSchema)) body: DomainInput,
  ) {
    return this.companies.addDomain(id, body.domain);
  }

  @RequirePermission('companies.manage')
  @Delete(':id/domains/:domainId')
  removeDomain(@Param('id') id: string, @Param('domainId') domainId: string) {
    return this.companies.removeDomain(id, domainId);
  }

  @RequirePermission('companies.manage')
  @Post(':id/holidays')
  addHoliday(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(holidaySchema)) body: HolidayInput,
  ) {
    return this.companies.addHoliday(id, body);
  }

  @RequirePermission('companies.manage')
  @Delete(':id/holidays/:holidayId')
  removeHoliday(@Param('id') id: string, @Param('holidayId') holidayId: string) {
    return this.companies.removeHoliday(id, holidayId);
  }

  @RequirePermission('companies.manage')
  @Put(':id/hidden-categories')
  setHiddenCategories(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(hiddenSetSchema)) body: HiddenSetInput,
  ) {
    return this.companies.setHiddenCategories(id, body);
  }

  @RequirePermission('companies.manage')
  @Put(':id/hidden-items')
  setHiddenItems(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(hiddenSetSchema)) body: HiddenSetInput,
  ) {
    return this.companies.setHiddenItems(id, body);
  }

  @RequirePermission('companies.manage')
  @Put(':id/tier')
  setTier(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(companyTierSchema)) body: CompanyTierInput,
  ) {
    return this.companies.setTier(id, body.priceTierId ?? null);
  }
}
