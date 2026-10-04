import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service.js';
import { createTestCompany, requireTestDatabaseUrl, truncateAll } from '../../../test/db.js';
import { EmployeesService } from '../employees/employees.service.js';
import { CompaniesService } from './companies.service.js';

/**
 * Company lifecycle. PDF §4.4.
 * Fixtures go through the real service via `createTestCompany`
 * so they stay reconcilable.
 */
describe('CompaniesService', () => {
  const prisma = new PrismaService(requireTestDatabaseUrl());
  const companies = new CompaniesService(prisma);

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a company with its owner in one transaction', async () => {
    const { id } = await createTestCompany(prisma);
    const company = await prisma.company.findUniqueOrThrow({
      where: { id },
      include: { owner: true, domains: true, addresses: true },
    });
    expect(company.owner?.email).toBe('anil@acme.test');
    expect(company.domains).toHaveLength(1);
    expect(company.addresses.filter((address) => address.isDefault)).toHaveLength(1);
  });

  it('rejects public and duplicate domains', async () => {
    const { id } = await createTestCompany(prisma);
    await expect(companies.addDomain(id, 'gmail.com')).rejects.toMatchObject({
      code: 'DOMAIN_PUBLIC',
    });
    await expect(companies.addDomain(id, 'ACME.test')).rejects.toMatchObject({
      code: 'DOMAIN_TAKEN',
    });
  });

  it('protects the last domain and swaps the default address atomically', async () => {
    const { id } = await createTestCompany(prisma);
    const only = await prisma.companyEmailDomain.findFirstOrThrow({ where: { companyId: id } });
    await expect(companies.removeDomain(id, only.id)).rejects.toMatchObject({
      code: 'COMPANY_LAST_DOMAIN',
    });
    const second = await companies.addAddress(id, {
      label: 'Branch',
      line1: '2 Side Rd',
      line2: null,
      city: 'Mumbai',
      region: null,
      postalCode: '400002',
      country: 'IN',
      isDefault: false,
    });
    await companies.makeDefaultAddress(id, second.id);
    const defaults = await prisma.companyAddress.findMany({
      where: { companyId: id, isDefault: true },
    });
    expect(defaults.map((row) => row.id)).toEqual([second.id]);
  });

  it('blocks moving or deactivating the owner until replaced', async () => {
    const { id } = await createTestCompany(prisma);
    const owner = await prisma.employee.findFirstOrThrow({ where: { companyId: id } });
    const other = await prisma.employee.create({
      data: { companyId: id, name: 'Beth', email: 'beth@acme.test' },
      select: { id: true },
    });
    const employees = new EmployeesService(prisma);
    await expect(employees.setEmployeeActive(owner.id, false)).rejects.toMatchObject({
      code: 'OWNER_IMMUTABLE',
    });
    await companies.setOwner(id, other.id);
    await employees.setEmployeeActive(owner.id, false);
    const updated = await prisma.employee.findUniqueOrThrow({ where: { id: owner.id } });
    expect(updated.isActive).toBe(false);
  });

  it('lists assignable drivers only', async () => {
    const drivers = await companies.listDrivers();
    expect(drivers).toEqual([]);
  });
});
