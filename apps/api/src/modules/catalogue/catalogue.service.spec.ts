import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DomainError } from '@repo/shared';
import { PrismaService } from '../../database/prisma.service.js';
import { requireTestDatabaseUrl, truncateAll } from '../../../test/db.js';
import { assertNoPortions } from './domain/catalogue-validation.js';
import { CatalogueService, parseReferenceList } from './catalogue.service.js';

/**
 * Catalogue Must-only store. PDF §4.1.
 * Builds through the real service (never raw inserts) so later
 * pricing/menu tests inherit reconcilable fixtures.
 */
describe('CatalogueService', () => {
  const prisma = new PrismaService(requireTestDatabaseUrl());
  const catalogue = new CatalogueService(prisma);

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('trims reference names and rejects blank ones', async () => {
    const row = await catalogue.createReference('allergens', { name: '  Peanut  ' });
    expect(row.name).toBe('Peanut');
    await expect(catalogue.createReference('allergens', { name: '   ' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects duplicate reference names case-insensitively', async () => {
    await catalogue.createReference('allergens', { name: 'Peanut' });
    await expect(catalogue.createReference('allergens', { name: 'peanut' })).rejects.toMatchObject(
      { code: 'REFERENCE_DUPLICATE' },
    );
  });

  it('refuses to deactivate a station used by an active dish', async () => {
    const station = await catalogue.createReference('stations', { name: 'Tandoor', sortOrder: 0 });
    await catalogue.createDish({
      name: 'Bowl',
      description: null,
      imageUrl: null,
      sku: 'BOWL-1',
      temperature: 'HOT',
      costCents: 300,
      stationId: station.id,
      minOrderQuantity: null,
      allergenIds: [],
      dietaryTagIds: [],
    });
    await expect(catalogue.setReferenceActive('stations', station.id, false)).rejects.toMatchObject(
      { code: 'REFERENCE_IN_USE' },
    );
  });

  it('rejects portion payloads until portions are built', () => {
    expect(() => assertNoPortions({ usesPortions: true })).toThrow(
      expect.objectContaining({ code: 'PORTIONS_DEFERRED' }),
    );
    expect(() => assertNoPortions({ sizes: [{ id: 'x' }] })).toThrow(
      expect.objectContaining({ code: 'PORTIONS_DEFERRED' }),
    );
    expect(() => assertNoPortions({ name: 'Protein' })).not.toThrow();
  });

  it('rejects duplicate dish SKUs and deactivates instead of deleting', async () => {
    const dish = await catalogue.createDish({
      name: 'Bowl',
      description: null,
      imageUrl: null,
      sku: 'BOWL-1',
      temperature: 'HOT',
      costCents: 300,
      stationId: null,
      minOrderQuantity: null,
      allergenIds: [],
      dietaryTagIds: [],
    });
    await expect(
      catalogue.createDish({
        name: 'Other Bowl',
        description: null,
        imageUrl: null,
        sku: 'BOWL-1',
        temperature: 'COLD',
        costCents: 200,
        stationId: null,
        minOrderQuantity: null,
        allergenIds: [],
        dietaryTagIds: [],
      }),
    ).rejects.toMatchObject({ code: 'SKU_TAKEN' });
    await catalogue.setDishActive(dish.id, false);
    const found = await prisma.dish.findUnique({ where: { id: dish.id } });
    expect(found?.isActive).toBe(false);
  });

  it('rejects attaching the same option to a group twice', async () => {
    const dish = await catalogue.createDish({
      name: 'Bowl',
      description: null,
      imageUrl: null,
      sku: 'BOWL-2',
      temperature: 'HOT',
      costCents: 300,
      stationId: null,
      minOrderQuantity: null,
      allergenIds: [],
      dietaryTagIds: [],
    });
    const group = await catalogue.createGroup(
      dish.id,
      { name: 'Protein' },
      { name: 'Protein', isRequired: true, sortOrder: 0 },
    );
    const option = await catalogue.createOption({
      name: 'Paneer',
      description: null,
      costCents: 100,
      allergenIds: [],
      dietaryTagIds: [],
    });
    await catalogue.attachOption(group.id, { optionId: option.id, sortOrder: 0 });
    await expect(
      catalogue.attachOption(group.id, { optionId: option.id, sortOrder: 1 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('parses reference list names strictly', () => {
    expect(parseReferenceList('stations')).toBe('stations');
    expect(() => parseReferenceList('nope')).toThrow(DomainError);
  });
});
