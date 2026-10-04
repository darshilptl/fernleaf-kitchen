import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError, isPublicDomain, isValidDomainShape, normalizeDomain } from '@repo/shared';
import type {
  AddressInput,
  CreateCompanyInput,
  HiddenSetInput,
  HolidayInput,
  UpdateCompanyInput,
} from '@repo/shared';
import { PrismaService } from '../../database/prisma.service.js';
import { logAction } from '../../common/logging/logging.interceptor.js';
import { resolveDefaultAddresses } from './domain/company-guards.js';

/**
 * Companies: profile, domains, addresses, calendar, delivery
 * defaults, tier link, menu hiding. PDF §4.4.
 * Never hard-deleted; deactivation never touches history.
 */
@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listCompanies(query: {
    page: number;
    pageSize: number;
    search: string;
    active?: boolean;
  }): Promise<{ items: unknown[]; page: number; pageSize: number; total: number }> {
    const where = {
      ...(query.active === undefined ? {} : { isActive: query.active }),
      ...(query.search === '' ? {} : { name: { contains: query.search } }),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        select: {
          id: true,
          name: true,
          isActive: true,
          billingEmail: true,
          priceTier: { select: { id: true, name: true } },
          _count: { select: { employees: true } },
        },
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async getCompany(id: string): Promise<unknown> {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        priceTier: { select: { id: true, name: true } },
        defaultPackaging: { select: { id: true, name: true } },
        defaultDriver: { select: { id: true, name: true, email: true } },
        owner: { select: { id: true, name: true, email: true } },
        domains: { orderBy: { domain: 'asc' } },
        addresses: { orderBy: [{ isDefault: 'desc' }, { label: 'asc' }] },
        holidays: { orderBy: { date: 'asc' } },
        hiddenCategories: { select: { categoryId: true } },
        hiddenItems: { select: { menuItemId: true } },
        _count: { select: { employees: true, orders: true, invoices: true } },
      },
    });
    if (company === null) {
      throw new DomainError({
        code: 'COMPANY_NOT_FOUND',
        message: 'Company not found',
        httpStatus: 404,
      });
    }
    return company;
  }

  async createCompany(input: CreateCompanyInput): Promise<{ id: string }> {
    const domains = this.normalizeDomains(input.domains);
    const addresses = this.resolveAddresses(input.addresses);
    await this.requirePackaging(input.defaultPackagingTypeId);
    await this.requireTier(input.priceTierId);
    await this.requireDriver(input.defaultDriverId);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const company = await tx.company.create({
          data: {
            name: input.name.trim(),
            billingContactName: input.billingContactName.trim(),
            billingEmail: input.billingEmail.trim().toLowerCase(),
            billingPhone: input.billingPhone,
            billingAddress: input.billingAddress,
            workingDays: [...(input.workingDays ?? [1, 2, 3, 4, 5])],
            defaultDeliveryMinute: input.defaultDeliveryMinute,
            dispatchLeadMinutes: input.dispatchLeadMinutes ?? 60,
            defaultPackagingTypeId: input.defaultPackagingTypeId,
            driverInstructions: input.driverInstructions,
            defaultDriverId: input.defaultDriverId,
            priceTierId: input.priceTierId,
            domains: { create: domains.map((domain) => ({ domain })) },
            addresses: {
              create: addresses.map((address) => ({
                label: address.label.trim(),
                line1: address.line1.trim(),
                line2: address.line2,
                city: address.city.trim(),
                region: address.region,
                postalCode: address.postalCode.trim(),
                country: address.country.trim(),
                isDefault: address.isDefault,
              })),
            },
          },
          select: { id: true },
        });
        let owner;
        try {
          owner = await tx.employee.create({
            data: {
              companyId: company.id,
              name: input.ownerName.trim(),
              email: input.ownerEmail.trim().toLowerCase(),
            },
            select: { id: true },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new DomainError({
              code: 'EMPLOYEE_EMAIL_TAKEN',
              message: 'Owner email is already used',
              httpStatus: 409,
            });
          }
          throw error;
        }
        await tx.company.update({
          where: { id: company.id },
          data: { ownerEmployeeId: owner.id },
        });
        return company;
      });
      logAction(this.logger, 'company.create', { companyId: created.id });
      return created;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError({
          code: 'DOMAIN_TAKEN',
          message: 'Email domain is already claimed',
          httpStatus: 409,
        });
      }
      throw error;
    }
  }

  async updateCompany(id: string, input: UpdateCompanyInput): Promise<{ id: string }> {
    await this.requireCompany(id);
    if (input.priceTierId !== undefined) {
      await this.requireTier(input.priceTierId);
    }
    if (input.defaultDriverId !== undefined) {
      await this.requireDriver(input.defaultDriverId);
    }
    if (input.defaultPackagingTypeId !== undefined) {
      await this.requirePackaging(input.defaultPackagingTypeId);
    }
    await this.prisma.company.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.billingContactName !== undefined
          ? { billingContactName: input.billingContactName.trim() }
          : {}),
        ...(input.billingEmail !== undefined ? { billingEmail: input.billingEmail } : {}),
        ...(input.billingPhone !== undefined ? { billingPhone: input.billingPhone } : {}),
        ...(input.billingAddress !== undefined ? { billingAddress: input.billingAddress } : {}),
        ...(input.workingDays !== undefined ? { workingDays: [...input.workingDays] } : {}),
        ...(input.defaultDeliveryMinute !== undefined
          ? { defaultDeliveryMinute: input.defaultDeliveryMinute }
          : {}),
        ...(input.dispatchLeadMinutes !== undefined
          ? { dispatchLeadMinutes: input.dispatchLeadMinutes }
          : {}),
        ...(input.defaultPackagingTypeId !== undefined
          ? { defaultPackagingTypeId: input.defaultPackagingTypeId }
          : {}),
        ...(input.driverInstructions !== undefined
          ? { driverInstructions: input.driverInstructions }
          : {}),
        ...(input.defaultDriverId !== undefined ? { defaultDriverId: input.defaultDriverId } : {}),
        ...(input.priceTierId !== undefined ? { priceTierId: input.priceTierId } : {}),
      },
    });
    logAction(this.logger, 'company.update', { companyId: id });
    return { id };
  }

  async setCompanyActive(id: string, isActive: boolean): Promise<{ id: string }> {
    await this.requireCompany(id);
    await this.prisma.company.update({ where: { id }, data: { isActive } });
    logAction(this.logger, isActive ? 'company.activate' : 'company.deactivate', { companyId: id });
    return { id };
  }

  async setOwner(companyId: string, employeeId: string): Promise<{ id: string }> {
    await this.requireCompany(companyId);
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, companyId: true, isActive: true },
    });
    if (employee === null || employee.companyId !== companyId || !employee.isActive) {
      throw new DomainError({
        code: 'OWNER_IMMUTABLE',
        message: 'Owner must be an active employee of this company',
        httpStatus: 409,
      });
    }
    await this.prisma.company.update({
      where: { id: companyId },
      data: { ownerEmployeeId: employeeId },
    });
    logAction(this.logger, 'company.set-owner', { companyId, employeeId });
    return { id: companyId };
  }

  async addAddress(companyId: string, input: AddressInput): Promise<{ id: string }> {
    await this.requireCompany(companyId);
    const existing = await this.prisma.companyAddress.findMany({
      where: { companyId, isActive: true },
      select: { id: true },
    });
    const makeDefault = existing.length === 0 ? true : (input.isDefault ?? false);
    const address = await this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.companyAddress.updateMany({ where: { companyId }, data: { isDefault: false } });
      }
      return tx.companyAddress.create({
        data: {
          companyId,
          label: input.label.trim(),
          line1: input.line1.trim(),
          line2: input.line2,
          city: input.city.trim(),
          region: input.region,
          postalCode: input.postalCode.trim(),
          country: input.country.trim(),
          isDefault: makeDefault,
        },
        select: { id: true },
      });
    });
    logAction(this.logger, 'company.add-address', { companyId, addressId: address.id });
    return address;
  }

  async makeDefaultAddress(companyId: string, addressId: string): Promise<{ id: string }> {
    const address = await this.prisma.companyAddress.findUnique({
      where: { id: addressId },
      select: { id: true, companyId: true, isActive: true },
    });
    if (address === null || address.companyId !== companyId || !address.isActive) {
      throw new DomainError({
        code: 'ADDRESS_NOT_FOUND',
        message: 'Address not found',
        httpStatus: 404,
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.companyAddress.updateMany({ where: { companyId }, data: { isDefault: false } });
      await tx.companyAddress.update({ where: { id: addressId }, data: { isDefault: true } });
    });
    logAction(this.logger, 'company.make-default-address', { companyId, addressId });
    return { id: addressId };
  }

  async addDomain(companyId: string, raw: string): Promise<{ id: string }> {
    await this.requireCompany(companyId);
    const domain = this.normalizeDomains([raw])[0];
    if (domain === undefined) {
      throw new DomainError({
        code: 'VALIDATION_ERROR',
        path: 'domain',
        message: 'Domain must not be blank',
        httpStatus: 400,
      });
    }
    try {
      const row = await this.prisma.companyEmailDomain.create({
        data: { companyId, domain },
        select: { id: true },
      });
      logAction(this.logger, 'company.add-domain', { companyId, domainId: row.id });
      return row;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError({
          code: 'DOMAIN_TAKEN',
          message: 'Email domain is already claimed',
          httpStatus: 409,
        });
      }
      throw error;
    }
  }

  async removeDomain(companyId: string, domainId: string): Promise<{ ok: true }> {
    const remaining = await this.prisma.companyEmailDomain.count({ where: { companyId } });
    if (remaining <= 1) {
      throw new DomainError({
        code: 'COMPANY_LAST_DOMAIN',
        message: 'A company must keep at least one domain',
        httpStatus: 409,
      });
    }
    await this.prisma.companyEmailDomain.deleteMany({ where: { id: domainId, companyId } });
    logAction(this.logger, 'company.remove-domain', { companyId, domainId });
    return { ok: true };
  }

  async addHoliday(companyId: string, input: HolidayInput): Promise<{ id: string }> {
    await this.requireCompany(companyId);
    const holiday = await this.prisma.companyHoliday.upsert({
      where: { companyId_date: { companyId, date: new Date(`${input.date}T00:00:00.000Z`) } },
      update: { name: input.name },
      create: {
        companyId,
        date: new Date(`${input.date}T00:00:00.000Z`),
        name: input.name,
      },
      select: { id: true },
    });
    logAction(this.logger, 'company.add-holiday', { companyId, holidayId: holiday.id });
    return holiday;
  }

  async removeHoliday(companyId: string, holidayId: string): Promise<{ ok: true }> {
    await this.prisma.companyHoliday.deleteMany({ where: { id: holidayId, companyId } });
    logAction(this.logger, 'company.remove-holiday', { companyId, holidayId });
    return { ok: true };
  }

  async setHiddenCategories(companyId: string, input: HiddenSetInput): Promise<{ ok: true }> {
    await this.requireCompany(companyId);
    await this.prisma.$transaction(async (tx) => {
      await tx.companyHiddenCategory.deleteMany({ where: { companyId } });
      if (input.ids.length > 0) {
        await tx.companyHiddenCategory.createMany({
          data: input.ids.map((categoryId) => ({ companyId, categoryId })),
          skipDuplicates: true,
        });
      }
    });
    logAction(this.logger, 'company.set-hidden-categories', { companyId, count: input.ids.length });
    return { ok: true };
  }

  async setHiddenItems(companyId: string, input: HiddenSetInput): Promise<{ ok: true }> {
    await this.requireCompany(companyId);
    await this.prisma.$transaction(async (tx) => {
      await tx.companyHiddenItem.deleteMany({ where: { companyId } });
      if (input.ids.length > 0) {
        await tx.companyHiddenItem.createMany({
          data: input.ids.map((menuItemId) => ({ companyId, menuItemId })),
          skipDuplicates: true,
        });
      }
    });
    logAction(this.logger, 'company.set-hidden-items', { companyId, count: input.ids.length });
    return { ok: true };
  }

  async setTier(companyId: string, priceTierId: string | null): Promise<{ id: string }> {
    await this.requireCompany(companyId);
    await this.requireTier(priceTierId);
    await this.prisma.company.update({ where: { id: companyId }, data: { priceTierId } });
    logAction(this.logger, 'company.set-tier', { companyId });
    return { id: companyId };
  }

  async listDrivers(): Promise<Array<{ id: string; name: string; email: string }>> {
    const staff = await this.prisma.staffUser.findMany({
      where: { isActive: true, role: { permissions: { some: { permission: 'deliveries.assignable' } } } },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
    return staff;
  }

  private normalizeDomains(raw: string[]): string[] {
    return raw.map((entry) => {
      const domain = normalizeDomain(entry);
      if (!isValidDomainShape(domain)) {
        throw new DomainError({
          code: 'VALIDATION_ERROR',
          path: 'domains',
          message: `Invalid domain: ${entry}`,
          httpStatus: 400,
        });
      }
      if (isPublicDomain(domain)) {
        throw new DomainError({
          code: 'DOMAIN_PUBLIC',
          message: `Public domains are not allowed: ${domain}`,
          httpStatus: 409,
        });
      }
      return domain;
    });
  }

  private resolveAddresses(addresses: AddressInput[]): AddressInput[] {
    try {
      return resolveDefaultAddresses(addresses);
    } catch {
      throw new DomainError({
        code: 'VALIDATION_ERROR',
        path: 'addresses',
        message: 'Exactly one address must be the default',
        httpStatus: 400,
      });
    }
  }

  private async requireCompany(id: string): Promise<{ id: string }> {
    const company = await this.prisma.company.findUnique({ where: { id }, select: { id: true } });
    if (company === null) {
      throw new DomainError({
        code: 'COMPANY_NOT_FOUND',
        message: 'Company not found',
        httpStatus: 404,
      });
    }
    return company;
  }

  private async requirePackaging(id: string): Promise<void> {
    const packaging = await this.prisma.packagingType.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (packaging === null || !packaging.isActive) {
      throw new DomainError({
        code: 'VALIDATION_ERROR',
        path: 'defaultPackagingTypeId',
        message: 'Packaging type not found or inactive',
        httpStatus: 400,
      });
    }
  }

  private async requireTier(id: string | null | undefined): Promise<void> {
    if (id === null || id === undefined) {
      return;
    }
    const tier = await this.prisma.priceTier.findUnique({ where: { id }, select: { id: true } });
    if (tier === null) {
      throw new DomainError({ code: 'TIER_NOT_FOUND', message: 'Tier not found', httpStatus: 404 });
    }
  }

  private async requireDriver(id: string | null | undefined): Promise<void> {
    if (id === null || id === undefined) {
      return;
    }
    const driver = await this.prisma.staffUser.findUnique({
      where: { id },
      include: { role: { include: { permissions: true } } },
    });
    const eligible =
      driver !== null &&
      driver.isActive &&
      driver.role.permissions.some((row) => row.permission === 'deliveries.assignable');
    if (!eligible) {
      throw new DomainError({
        code: 'DRIVER_INELIGIBLE',
        message: 'Default driver must be active assignable staff',
        httpStatus: 409,
      });
    }
  }
}
