import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/database/prisma.service.js';
import { requireTestDatabaseUrl, truncateAll } from '../../test/db.js';
import { PricingService } from '../../src/modules/pricing/pricing.service.js';
import { MenuService } from '../../src/modules/menu/menu.service.js';
import { seedPart1 } from './part-1.js';

/**
 * Seed part-1 acceptance. PDF §2 + docs/demo-data.md "Expected
 * previews". Runs against the TEST database only, truncates
 * first per repo harness, never touches reviewer data.
 */

interface ExpectedItem {
  name: string;
  priceCents: number;
}

interface ExpectedCategory {
  name: string;
  items: ExpectedItem[];
}

async function previewShape(
  menu: MenuService,
  prisma: PrismaService,
  email: string,
  slug: string | null,
): Promise<{ categories: ExpectedCategory[]; banner: string | null }> {
  const employee = await prisma.employee.findUniqueOrThrow({ where: { email } });
  const preview = await menu.preview(employee.id, slug);
  return {
    categories: preview.categories.map((category) => ({
      name: category.name,
      items: category.items.map((item) => ({ name: item.name, priceCents: item.priceCents })),
    })),
    banner: preview.banner,
  };
}

describe('seed part 1', () => {
  const prisma = new PrismaService(requireTestDatabaseUrl());
  const pricing = new PricingService(prisma);
  const menu = new MenuService(prisma, pricing);

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function counts(): Promise<Record<string, number>> {
    const [dishes, options, tiers, companyCount, employeeCount, categories] = await Promise.all([
      prisma.dish.count(),
      prisma.option.count(),
      prisma.priceTier.count(),
      prisma.company.count(),
      prisma.employee.count(),
      prisma.menuCategory.count(),
    ]);
    return {
      dishes,
      options,
      tiers,
      companies: companyCount,
      employees: employeeCount,
      categories,
    };
  }

  it('seeding twice changes zero rows', async () => {
    await seedPart1(prisma);
    const first = await counts();
    expect(first).toEqual({
      dishes: 9,
      options: 7,
      tiers: 3,
      companies: 5,
      employees: 19,
      categories: 5,
    });
    await seedPart1(prisma);
    expect(await counts()).toEqual(first);
  });

  it('never overwrites pre-existing rows', async () => {
    await seedPart1(prisma);
    const dish = await prisma.dish.findUniqueOrThrow({ where: { sku: 'BWL-101' } });
    const standard = await prisma.priceTier.findFirstOrThrow({ where: { name: 'Standard' } });
    await prisma.dishTierPrice.upsert({
      where: { tierId_dishId: { tierId: standard.id, dishId: dish.id } },
      update: { priceCents: 999 },
      create: { tierId: standard.id, dishId: dish.id, priceCents: 999 },
    });
    const acme = await prisma.company.findFirstOrThrow({
      where: { domains: { some: { domain: 'acme-foods.example' } } },
    });
    await prisma.companyEmailDomain.create({
      data: { companyId: acme.id, domain: 'extra.example' },
    });
    await seedPart1(prisma);
    const kept = await prisma.dishTierPrice.findUniqueOrThrow({
      where: { tierId_dishId: { tierId: standard.id, dishId: dish.id } },
    });
    expect(kept.priceCents).toBe(999);
    const extra = await prisma.companyEmailDomain.findUniqueOrThrow({
      where: { domain: 'extra.example' },
    });
    expect(extra.companyId).toBe(acme.id);
  });

  it('Riya Shah sees the Enterprise menu exactly', async () => {
    await seedPart1(prisma);
    const actual = await previewShape(menu, prisma, 'riya.shah@acme-foods.example', null);
    expect(actual.banner).toBeNull();
    expect(actual.categories).toEqual([
      {
        name: 'Bowls',
        items: [
          { name: 'Paneer Rice Bowl', priceCents: 805 },
          { name: 'Chickpea Power Bowl', priceCents: 725 },
          { name: 'Tofu Teriyaki Bowl', priceCents: 795 },
        ],
      },
      { name: 'Breakfast', items: [{ name: 'Masala Omelette Wrap', priceCents: 635 }] },
      {
        name: 'Desserts',
        items: [
          { name: 'Gulab Jamun (2 pcs)', priceCents: 405 },
          { name: 'Mango Chia Pudding', priceCents: 460 },
        ],
      },
    ]);
    const secret = await previewShape(menu, prisma, 'riya.shah@acme-foods.example', 'chefs-table');
    expect(secret.categories).toEqual([
      {
        name: "Chef's Table",
        items: [
          { name: "Chef's Thali", priceCents: 1095 },
          { name: 'Paneer Rice Bowl', priceCents: 805 },
        ],
      },
    ]);
  });

  it('Maya Rao sees Standard without Desserts', async () => {
    await seedPart1(prisma);
    const actual = await previewShape(menu, prisma, 'maya.rao@globex-logistics.example', null);
    expect(actual.banner).toBeNull();
    expect(actual.categories).toEqual([
      {
        name: 'Bowls',
        items: [
          { name: 'Paneer Rice Bowl', priceCents: 700 },
          { name: 'Chickpea Power Bowl', priceCents: 650 },
          { name: 'Tofu Teriyaki Bowl', priceCents: 690 },
        ],
      },
      { name: 'Breakfast', items: [{ name: 'Masala Omelette Wrap', priceCents: 550 }] },
    ]);
  });

  it('Ishaan Gupta sees Partner with hidden Gulab Jamun', async () => {
    await seedPart1(prisma);
    const actual = await previewShape(menu, prisma, 'ishaan.gupta@initech-labs.example', null);
    expect(actual.banner).toBeNull();
    expect(actual.categories).toEqual([
      {
        name: 'Bowls',
        items: [
          { name: 'Paneer Rice Bowl', priceCents: 745 },
          { name: 'Chickpea Power Bowl', priceCents: 625 },
          { name: 'Tofu Teriyaki Bowl', priceCents: 720 },
        ],
      },
      {
        name: 'Breakfast',
        items: [
          { name: 'Masala Omelette Wrap', priceCents: 530 },
          { name: 'Overnight Oats Jar', priceCents: 460 },
        ],
      },
      { name: 'Desserts', items: [{ name: 'Mango Chia Pudding', priceCents: 385 }] },
    ]);
    const secret = await previewShape(
      menu,
      prisma,
      'ishaan.gupta@initech-labs.example',
      'chefs-table',
    );
    expect(secret.categories).toEqual([
      {
        name: "Chef's Table",
        items: [
          { name: "Chef's Thali", priceCents: 1010 },
          { name: 'Paneer Rice Bowl', priceCents: 745 },
        ],
      },
    ]);
  });

  it('Omar Sheikh gets the inactive banner', async () => {
    await seedPart1(prisma);
    const actual = await previewShape(menu, prisma, 'omar.sheikh@stark-interiors.example', null);
    expect(typeof actual.banner).toBe('string');
    expect((actual.banner ?? '').length).toBeGreaterThan(0);
  });
});
