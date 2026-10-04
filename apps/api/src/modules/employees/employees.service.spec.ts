import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service.js';
import { createTestCompany, requireTestDatabaseUrl, truncateAll } from '../../../test/db.js';
import { EmployeesService } from './employees.service.js';

/**
 * Employee lifecycle and CSV import. PDF §4.5.
 * Move guard queries real (empty) order tables per D-29.
 */
describe('EmployeesService', () => {
  const prisma = new PrismaService(requireTestDatabaseUrl());
  const employees = new EmployeesService(prisma);

  async function companyId(overrides?: {
    name?: string;
    billingEmail?: string;
    domains?: string[];
    ownerName?: string;
    ownerEmail?: string;
    packagingName?: string;
  }): Promise<string> {
    const created = await createTestCompany(prisma, overrides);
    return created.id;
  }

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects duplicate emails across all companies', async () => {
    const first = await companyId();
    await employees.createEmployee(first, {
      name: 'Ann',
      email: 'ann@acme.test',
      canChooseAddress: false,
      canChangeDeliveryTime: false,
      canChangePackaging: false,
      allergenIds: [],
      dietaryTagIds: [],
    });
    const second = await companyId({
      name: 'Beta',
      billingEmail: 'billing@beta.test',
      domains: ['beta.test'],
      ownerName: 'Bob',
      ownerEmail: 'bob@beta.test',
      packagingName: 'Box2',
    });
    await expect(
      employees.createEmployee(second, {
        name: 'Ann Clone',
        email: 'ANN@acme.test',
        canChooseAddress: false,
        canChangeDeliveryTime: false,
        canChangePackaging: false,
        allergenIds: [],
        dietaryTagIds: [],
      }),
    ).rejects.toMatchObject({ code: 'EMPLOYEE_EMAIL_TAKEN' });
  });

  it('moves employees freely while no open orders exist', async () => {
    const first = await companyId();
    const employee = await employees.createEmployee(first, {
      name: 'Mover',
      email: 'mover@acme.test',
      canChooseAddress: false,
      canChangeDeliveryTime: false,
      canChangePackaging: false,
      allergenIds: [],
      dietaryTagIds: [],
    });
    const second = await companyId({
      name: 'Gamma',
      billingEmail: 'billing@gamma.test',
      domains: ['gamma.test'],
      ownerName: 'Gus',
      ownerEmail: 'gus@gamma.test',
      packagingName: 'Box3',
    });
    await employees.updateEmployee(employee.id, { companyId: second });
    const moved = await prisma.employee.findUniqueOrThrow({ where: { id: employee.id } });
    expect(moved.companyId).toBe(second);
  });

  it('imports valid CSV rows and reports row-level errors', async () => {
    const id = await companyId();
    const csv = [
      'name,email',
      'Good One,good@acme.test',
      'Bad Email,not-an-email',
      'Duplicate,good@acme.test',
      ',empty@acme.test',
      'Second Good,second@acme.test',
    ].join('\n');
    const result = await employees.importCsv(id, csv);
    expect(result.imported).toBe(2);
    expect(result.errors.map((entry) => entry.row)).toEqual([3, 4, 5]);
    expect(await prisma.employee.count({ where: { companyId: id } })).toBe(3);
  });

  it('rejects oversized CSV files', async () => {
    const id = await companyId();
    const lines = ['name,email'];
    for (let index = 0; index < 1001; index += 1) {
      lines.push(`Person ${index},person${index}@acme.test`);
    }
    await expect(employees.importCsv(id, lines.join('\n'))).rejects.toMatchObject({
      code: 'CSV_TOO_LARGE',
    });
  });
});
