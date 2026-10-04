import { Logger } from '@nestjs/common';
import {
  addDays,
  isoWeekday,
  kitchenToday,
  parseMoney,
} from '@repo/shared';
import type { PrismaService } from '../../src/database/prisma.service.js';
import { ensureBaseData } from '../../src/modules/auth/base-data.js';
import { CatalogueService } from '../../src/modules/catalogue/catalogue.service.js';
import type { ReferenceList } from '../../src/modules/catalogue/catalogue.service.js';
import { CompaniesService } from '../../src/modules/companies/companies.service.js';
import { EmployeesService } from '../../src/modules/employees/employees.service.js';
import { MenuService } from '../../src/modules/menu/menu.service.js';
import { PricingService } from '../../src/modules/pricing/pricing.service.js';
import { logAction } from '../../src/common/logging/logging.interceptor.js';

/**
 * Demo data part 1: reference, catalogue, pricing, companies,
 * employees, menu. PDF §2 + docs/demo-data.md (loads it exactly).
 *
 * Rules: real services only (Prisma reads for id lookups, never
 * writes); create-if-missing by natural key, never overwrite or
 * delete; idempotent; no boot hook yet (Group 5). Part-1 rows are
 * identified by their doc-fixed natural keys (D-81); no account
 * outside the four test accounts gets a known password (D-86 —
 * seed employees have no credentials at all).
 */

const logger = new Logger('seed-part-1');

const ALLERGENS = ['Gluten', 'Dairy', 'Nuts', 'Peanuts', 'Soy', 'Eggs', 'Sesame', 'Mustard'];
const DIETARY_TAGS = ['Vegan', 'Vegetarian', 'Jain', 'Gluten-free', 'Halal'];
const STATIONS = ['Bowls', 'Cold Kitchen', 'Breakfast', 'Desserts'];
const PORTION_SIZES = ['Regular', 'Large'];
const PACKAGING_TYPES = ['Standard box', 'Eco compostable', 'Insulated bag'];

interface OptionSeed {
  name: string;
  cost: string;
  standard: string;
}

const OPTIONS: OptionSeed[] = [
  { name: 'Brown rice', cost: '0.40', standard: '0.00' },
  { name: 'Jeera rice', cost: '0.50', standard: '0.50' },
  { name: 'Raita', cost: '0.40', standard: '0.60' },
  { name: 'Mint chutney', cost: '0.20', standard: '0.30' },
  { name: 'Paneer', cost: '1.20', standard: '1.50' },
  { name: 'Tofu', cost: '1.00', standard: '1.20' },
  { name: 'Chickpeas', cost: '0.80', standard: '1.00' },
];

interface DishSeed {
  sku: string;
  name: string;
  temperature: 'HOT' | 'COLD';
  cost: string;
  station: string;
  allergens: string[];
  tags: string[];
  minQty: number | null;
  groups: Array<{ name: string; required: boolean; options: string[] }>;
}

const DISHES: DishSeed[] = [
  {
    sku: 'BWL-101', name: 'Paneer Rice Bowl', temperature: 'HOT', cost: '3.10', station: 'Bowls',
    allergens: ['Dairy'], tags: ['Vegetarian', 'Gluten-free'], minQty: 5,
    groups: [
      { name: 'Choose your rice', required: true, options: ['Brown rice', 'Jeera rice'] },
      { name: 'Add a side', required: false, options: ['Raita', 'Mint chutney'] },
    ],
  },
  {
    sku: 'BWL-102', name: 'Chickpea Power Bowl', temperature: 'HOT', cost: '2.60', station: 'Bowls',
    allergens: [], tags: ['Vegan', 'Gluten-free'], minQty: null,
    groups: [{ name: 'Choose your rice', required: true, options: ['Brown rice', 'Jeera rice'] }],
  },
  {
    sku: 'BWL-103', name: 'Tofu Teriyaki Bowl', temperature: 'HOT', cost: '3.00', station: 'Bowls',
    allergens: ['Soy'], tags: ['Vegan'], minQty: null,
    groups: [{ name: 'Choose your rice', required: true, options: ['Brown rice', 'Jeera rice'] }],
  },
  {
    sku: 'BRK-201', name: 'Masala Omelette Wrap', temperature: 'HOT', cost: '2.20',
    station: 'Breakfast', allergens: ['Eggs', 'Gluten'], tags: [], minQty: null, groups: [],
  },
  {
    sku: 'BRK-202', name: 'Overnight Oats Jar', temperature: 'COLD', cost: '1.90',
    station: 'Breakfast', allergens: ['Nuts', 'Gluten'], tags: ['Vegetarian'], minQty: null,
    groups: [],
  },
  {
    sku: 'DST-301', name: 'Gulab Jamun (2 pcs)', temperature: 'HOT', cost: '1.40',
    station: 'Desserts', allergens: ['Dairy', 'Gluten'], tags: ['Vegetarian'], minQty: null,
    groups: [],
  },
  {
    sku: 'DST-302', name: 'Mango Chia Pudding', temperature: 'COLD', cost: '1.60',
    station: 'Desserts', allergens: [], tags: ['Vegan', 'Gluten-free'], minQty: null, groups: [],
  },
  {
    sku: 'COL-401', name: 'Quinoa Salad Box', temperature: 'COLD', cost: '2.80',
    station: 'Cold Kitchen', allergens: [], tags: ['Vegan'], minQty: null, groups: [],
  },
  {
    sku: 'SPC-501', name: "Chef's Thali", temperature: 'HOT', cost: '4.20', station: 'Bowls',
    allergens: ['Dairy', 'Soy'], tags: ['Vegetarian'], minQty: null,
    groups: [{ name: 'Choose your protein', required: true, options: ['Paneer', 'Tofu', 'Chickpeas'] }],
  },
];

const STANDARD_PRICES: Record<string, string | null> = {
  'BWL-101': '7.00', 'BWL-102': '6.50', 'BWL-103': '6.90', 'BRK-201': '5.50', 'BRK-202': null,
  'DST-301': '3.50', 'DST-302': '4.00', 'COL-401': '7.20', 'SPC-501': '9.50',
};

interface AddressSeed {
  label: string;
  line1: string;
  city: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

interface CompanySeed {
  name: string;
  domain: string;
  tier: 'Enterprise' | 'Partner' | null;
  workingDays: number[];
  deliveryMinute: number;
  leadMinutes: number;
  packaging: string;
  addresses: AddressSeed[];
  holidayIsoWeekday: 1 | 5 | null;
  hideCategory: string | null;
  hideDishSku: string | null;
  active: boolean;
  owner: { name: string; email: string; flags?: { canChooseAddress?: boolean; canChangeDeliveryTime?: boolean; canChangePackaging?: boolean } };
  employees: Array<{
    name: string;
    email: string;
    flags?: { canChooseAddress?: boolean; canChangeDeliveryTime?: boolean; canChangePackaging?: boolean };
    allergens?: string[];
    tags?: string[];
    active?: boolean;
  }>;
}

const INDIA = 'IN';

const COMPANIES: CompanySeed[] = [
  {
    name: 'Acme Foods', domain: 'acme-foods.example', tier: 'Enterprise', workingDays: [1, 2, 3, 4, 5],
    deliveryMinute: 750, leadMinutes: 60, packaging: 'Standard box',
    addresses: [
      { label: 'HQ', line1: '14 Linking Road, Bandra West', city: 'Mumbai', postalCode: '400050', country: INDIA, isDefault: true },
      { label: 'Warehouse', line1: 'Plot 7, MIDC Industrial Area', city: 'Navi Mumbai', postalCode: '400710', country: INDIA, isDefault: false },
    ],
    holidayIsoWeekday: 5, hideCategory: null, hideDishSku: null, active: true,
    owner: { name: 'Riya Shah', email: 'riya.shah@acme-foods.example', flags: { canChangeDeliveryTime: true } },
    employees: [
      { name: 'Karan Mehta', email: 'karan.mehta@acme-foods.example', flags: { canChooseAddress: true } },
      { name: 'Neha Iyer', email: 'neha.iyer@acme-foods.example', allergens: ['Peanuts'] },
      { name: 'Aman Verma', email: 'aman.verma@acme-foods.example', flags: { canChangePackaging: true }, tags: ['Vegan'] },
      { name: 'Priya Nair', email: 'priya.nair@acme-foods.example' },
      { name: 'Dev Patel', email: 'dev.patel@acme-foods.example' },
    ],
  },
  {
    name: 'Globex Logistics', domain: 'globex-logistics.example', tier: null, workingDays: [1, 2, 3, 4, 5, 6],
    deliveryMinute: 780, leadMinutes: 45, packaging: 'Insulated bag',
    addresses: [
      { label: 'Main', line1: '22 Whitefield Main Road', city: 'Bengaluru', postalCode: '560066', country: INDIA, isDefault: true },
    ],
    holidayIsoWeekday: null, hideCategory: 'Desserts', hideDishSku: null, active: true,
    owner: { name: 'Maya Rao', email: 'maya.rao@globex-logistics.example' },
    employees: [
      { name: 'Sam Dsouza', email: 'sam.dsouza@globex-logistics.example' },
      { name: 'Tara Khan', email: 'tara.khan@globex-logistics.example', allergens: ['Dairy'] },
      { name: 'Vikram Joshi', email: 'vikram.joshi@globex-logistics.example' },
    ],
  },
  {
    name: 'Initech Labs', domain: 'initech-labs.example', tier: 'Partner', workingDays: [1, 2, 3, 4, 5],
    deliveryMinute: 720, leadMinutes: 60, packaging: 'Eco compostable',
    addresses: [
      { label: 'HQ', line1: '8 Hitech City Road', city: 'Hyderabad', postalCode: '500081', country: INDIA, isDefault: true },
      { label: 'Lab annex', line1: '3 Genome Valley', city: 'Hyderabad', postalCode: '500078', country: INDIA, isDefault: false },
    ],
    holidayIsoWeekday: null, hideCategory: null, hideDishSku: 'DST-301', active: true,
    owner: { name: 'Ishaan Gupta', email: 'ishaan.gupta@initech-labs.example' },
    employees: [
      { name: 'Leena Pillai', email: 'leena.pillai@initech-labs.example', tags: ['Jain'] },
      { name: 'Rohan Das', email: 'rohan.das@initech-labs.example' },
      { name: 'Zoya Ali', email: 'zoya.ali@initech-labs.example' },
    ],
  },
  {
    name: 'Hooli Studios', domain: 'hooli-studios.example', tier: 'Enterprise', workingDays: [1, 2, 3, 4, 5],
    deliveryMinute: 735, leadMinutes: 60, packaging: 'Standard box',
    addresses: [
      { label: 'Studio', line1: '5 Film City Road', city: 'Mumbai', postalCode: '400065', country: INDIA, isDefault: true },
    ],
    holidayIsoWeekday: 1, hideCategory: null, hideDishSku: null, active: true,
    owner: { name: 'Nina Kapoor', email: 'nina.kapoor@hooli-studios.example' },
    employees: [
      { name: 'Arjun Rao', email: 'arjun.rao@hooli-studios.example' },
      { name: 'Meera Sethi', email: 'meera.sethi@hooli-studios.example', active: false },
    ],
  },
  {
    name: 'Stark Interiors', domain: 'stark-interiors.example', tier: null, workingDays: [1, 2, 3, 4, 5],
    deliveryMinute: 705, leadMinutes: 90, packaging: 'Standard box',
    addresses: [
      { label: 'Office', line1: '11 MG Road', city: 'Gurugram', postalCode: '122002', country: INDIA, isDefault: true },
    ],
    holidayIsoWeekday: null, hideCategory: null, hideDishSku: null, active: false,
    owner: { name: 'Omar Sheikh', email: 'omar.sheikh@stark-interiors.example' },
    employees: [
      { name: 'Pooja Menon', email: 'pooja.menon@stark-interiors.example' },
    ],
  },
];

interface CategorySeed {
  name: string;
  sortOrder: number;
  secret: boolean;
  slug: string | null;
  skus: string[];
}

const CATEGORIES: CategorySeed[] = [
  { name: 'Bowls', sortOrder: 1, secret: false, slug: null, skus: ['BWL-101', 'BWL-102', 'BWL-103', 'COL-401'] },
  { name: 'Breakfast', sortOrder: 2, secret: false, slug: null, skus: ['BRK-201', 'BRK-202'] },
  { name: 'Desserts', sortOrder: 3, secret: false, slug: null, skus: ['DST-301', 'DST-302'] },
  { name: "Chef's Table", sortOrder: 4, secret: true, slug: 'chefs-table', skus: ['SPC-501', 'BWL-101'] },
  { name: 'Seasonal', sortOrder: 5, secret: false, slug: null, skus: ['DST-302'] },
];

/** Monday of the ISO week starting after today; Friday is +4. */
function nextWeekMonday(today: string): string {
  return addDays(today, 8 - isoWeekday(today));
}

export async function seedPart1(prisma: PrismaService): Promise<void> {
  const catalogue = new CatalogueService(prisma);
  const pricing = new PricingService(prisma);
  const companies = new CompaniesService(prisma);
  const employees = new EmployeesService(prisma);
  const menu = new MenuService(prisma, pricing);

  await seedReference(catalogue);
  const optionIds = await seedOptions(prisma, catalogue);
  const dishIds = await seedDishes(prisma, catalogue, optionIds);
  const tierIds = await seedTiers(prisma, pricing, dishIds, optionIds);
  const companyIds = await seedCompanies(prisma, companies, tierIds);
  await seedEmployees(prisma, employees, companyIds);
  await seedMenu(prisma, menu, companies, dishIds, companyIds);
  logAction(logger, 'seed.part-1.done', {});
}

async function seedReference(catalogue: CatalogueService): Promise<void> {
  const lists: Array<{ list: ReferenceList; names: string[] }> = [
    { list: 'allergens', names: ALLERGENS },
    { list: 'dietary-tags', names: DIETARY_TAGS },
    { list: 'stations', names: STATIONS },
    { list: 'portion-sizes', names: PORTION_SIZES },
    { list: 'packaging-types', names: PACKAGING_TYPES },
  ];
  for (const { list, names } of lists) {
    const existing = await catalogue.listReference(list);
    const known = new Set(existing.map((row) => row.name));
    for (const name of names) {
      if (!known.has(name)) {
        await catalogue.createReference(list, { name, sortOrder: 0 });
      }
    }
  }
  logAction(logger, 'seed.reference.done', {});
}

async function seedOptions(
  prisma: PrismaService,
  catalogue: CatalogueService,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const option of OPTIONS) {
    const found = await prisma.option.findFirst({ where: { name: option.name } });
    if (found !== null) {
      ids.set(option.name, found.id);
      continue;
    }
    const created = await catalogue.createOption({
      name: option.name,
      description: null,
      costCents: parseMoney(option.cost),
      allergenIds: [],
      dietaryTagIds: [],
    });
    ids.set(option.name, created.id);
  }
  logAction(logger, 'seed.options.done', { count: ids.size });
  return ids;
}

async function seedDishes(
  prisma: PrismaService,
  catalogue: CatalogueService,
  optionIds: Map<string, string>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const dish of DISHES) {
    let dishId: string;
    const found = await prisma.dish.findUnique({ where: { sku: dish.sku } });
    if (found !== null) {
      dishId = found.id;
    } else {
      const station = await prisma.kitchenStation.findFirst({ where: { name: dish.station } });
      const allergenRows = await prisma.allergen.findMany({
        where: { name: { in: dish.allergens } },
      });
      const tagRows = await prisma.dietaryTag.findMany({ where: { name: { in: dish.tags } } });
      const created = await catalogue.createDish({
        name: dish.name,
        description: null,
        imageUrl: null,
        sku: dish.sku,
        temperature: dish.temperature,
        costCents: parseMoney(dish.cost),
        stationId: station?.id ?? null,
        minOrderQuantity: dish.minQty,
        allergenIds: allergenRows.map((row) => row.id),
        dietaryTagIds: tagRows.map((row) => row.id),
      });
      dishId = created.id;
      let sortOrder = 0;
      for (const group of dish.groups) {
        const createdGroup = await catalogue.createGroup(
          dishId,
          {},
          { name: group.name, isRequired: group.required, sortOrder },
        );
        sortOrder += 1;
        let optionOrder = 0;
        for (const optionName of group.options) {
          const optionId = optionIds.get(optionName);
          if (optionId !== undefined) {
            await catalogue.attachOption(createdGroup.id, { optionId, sortOrder: optionOrder });
            optionOrder += 1;
          }
        }
      }
    }
    ids.set(dish.sku, dishId);
  }
  logAction(logger, 'seed.dishes.done', { count: ids.size });
  return ids;
}

async function seedTiers(
  prisma: PrismaService,
  pricing: PricingService,
  dishIds: Map<string, string>,
  optionIds: Map<string, string>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const name of ['Standard', 'Enterprise', 'Partner']) {
    const found = await prisma.priceTier.findFirst({ where: { name } });
    if (found !== null) {
      ids.set(name, found.id);
      continue;
    }
    const created = await pricing.createTier({ name });
    ids.set(name, created.id);
  }
  const standardId = ids.get('Standard');
  const enterpriseId = ids.get('Enterprise');
  const partnerId = ids.get('Partner');
  if (standardId === undefined || enterpriseId === undefined || partnerId === undefined) {
    throw new Error('seed tiers missing');
  }
  await pricing.saveRule(enterpriseId, {
    derivationBasis: 'TIER',
    sourceTierId: standardId,
    multiplierBp: 11500,
  });
  await pricing.saveRule(partnerId, {
    derivationBasis: 'COST',
    sourceTierId: null,
    multiplierBp: 24000,
  });
  const dishPrices: Array<{ itemId: string; priceCents: number }> = [];
  for (const [sku, dollars] of Object.entries(STANDARD_PRICES)) {
    if (dollars === null) {
      continue;
    }
    const dishId = dishIds.get(sku);
    if (dishId !== undefined) {
      const existing = await prisma.dishTierPrice.findUnique({
        where: { tierId_dishId: { tierId: standardId, dishId } },
      });
      if (existing === null) {
        dishPrices.push({ itemId: dishId, priceCents: parseMoney(dollars) });
      }
    }
  }
  const optionPrices: Array<{ itemId: string; priceCents: number }> = [];
  for (const option of OPTIONS) {
    const optionId = optionIds.get(option.name);
    if (optionId === undefined) {
      continue;
    }
    const existing = await prisma.optionTierPrice.findUnique({
      where: { tierId_optionId: { tierId: standardId, optionId } },
    });
    if (existing === null) {
      optionPrices.push({ itemId: optionId, priceCents: parseMoney(option.standard) });
    }
  }
  if (dishPrices.length > 0 || optionPrices.length > 0) {
    await pricing.saveBatchPrices(standardId, { dishPrices, optionPrices });
  }
  const bwl102 = dishIds.get('BWL-102');
  if (bwl102 !== undefined) {
    const existing = await prisma.dishTierPrice.findUnique({
      where: { tierId_dishId: { tierId: enterpriseId, dishId: bwl102 } },
    });
    if (existing === null) {
      await pricing.saveBatchPrices(enterpriseId, {
        dishPrices: [{ itemId: bwl102, priceCents: parseMoney('7.25') }],
        optionPrices: [],
      });
    }
  }
  logAction(logger, 'seed.tiers.done', { count: ids.size });
  return ids;
}

async function seedCompanies(
  prisma: PrismaService,
  companies: CompaniesService,
  tierIds: Map<string, string>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const driver = await prisma.staffUser.findUnique({ where: { email: 'driver@test.com' } });
  const today = kitchenToday(new Date());
  const nextMonday = addDays(today, 8 - isoWeekday(today));
  for (const company of COMPANIES) {
    const found = await prisma.company.findFirst({
      where: { domains: { some: { domain: company.domain } } },
    });
    let companyId: string;
    if (found !== null) {
      companyId = found.id;
    } else {
      const packaging = await prisma.packagingType.findFirst({ where: { name: company.packaging } });
      if (packaging === null) {
        throw new Error(`seed packaging missing: ${company.packaging}`);
      }
      const tierId = company.tier === null ? null : (tierIds.get(company.tier) ?? null);
      const created = await companies.createCompany({
        name: company.name,
        billingContactName: `${company.owner.name} (billing)`,
        billingEmail: `billing@${company.domain}`,
        billingPhone: null,
        billingAddress: null,
        domains: [company.domain],
        addresses: company.addresses.map((address) => ({
          label: address.label,
          line1: address.line1,
          line2: null,
          city: address.city,
          region: null,
          postalCode: address.postalCode,
          country: address.country,
          isDefault: address.isDefault,
        })),
        ownerName: company.owner.name,
        ownerEmail: company.owner.email,
        workingDays: company.workingDays,
        defaultDeliveryMinute: company.deliveryMinute,
        dispatchLeadMinutes: company.leadMinutes,
        defaultPackagingTypeId: packaging.id,
        driverInstructions: null,
        defaultDriverId:
          driver !== null && (company.name === 'Acme Foods' || company.name === 'Initech Labs')
            ? driver.id
            : null,
        priceTierId: tierId,
      });
      companyId = created.id;
      if (!company.active) {
        await companies.setCompanyActive(companyId, false);
      }
    }
    if (company.holidayIsoWeekday !== null) {
      const date = addDays(nextMonday, company.holidayIsoWeekday - 1);
      const existing = await prisma.companyHoliday.findFirst({
        where: { companyId, name: 'Demo day off', date: { gte: new Date(`${today}T00:00:00.000Z`) } },
      });
      if (existing === null) {
        await companies.addHoliday(companyId, { date, name: 'Demo day off' });
      }
    }
    ids.set(company.name, companyId);
  }
  logAction(logger, 'seed.companies.done', { count: ids.size });
  return ids;
}

async function seedEmployees(
  prisma: PrismaService,
  employees: EmployeesService,
  companyIds: Map<string, string>,
): Promise<void> {
  for (const company of COMPANIES) {
    const companyId = companyIds.get(company.name);
    if (companyId === undefined) {
      throw new Error(`seed company missing: ${company.name}`);
    }
    for (const member of company.employees) {
      const found = await prisma.employee.findUnique({ where: { email: member.email } });
      if (found !== null) {
        continue;
      }
      const allergenRows =
        member.allergens === undefined || member.allergens.length === 0
          ? []
          : await prisma.allergen.findMany({ where: { name: { in: member.allergens } } });
      const tagRows =
        member.tags === undefined || member.tags.length === 0
          ? []
          : await prisma.dietaryTag.findMany({ where: { name: { in: member.tags } } });
      const created = await employees.createEmployee(companyId, {
        name: member.name,
        email: member.email,
        canChooseAddress: member.flags?.canChooseAddress ?? false,
        canChangeDeliveryTime: member.flags?.canChangeDeliveryTime ?? false,
        canChangePackaging: member.flags?.canChangePackaging ?? false,
        allergenIds: allergenRows.map((row) => row.id),
        dietaryTagIds: tagRows.map((row) => row.id),
      });
      if (member.active === false) {
        await employees.setEmployeeActive(created.id, false);
      }
    }
  }
  logAction(logger, 'seed.employees.done', {});
}

async function seedMenu(
  prisma: PrismaService,
  menu: MenuService,
  companies: CompaniesService,
  dishIds: Map<string, string>,
  companyIds: Map<string, string>,
): Promise<void> {
  for (const category of CATEGORIES) {
    let categoryId: string;
    const found = await prisma.menuCategory.findUnique({ where: { slug: category.slug ?? slugify(category.name) } });
    if (found !== null) {
      categoryId = found.id;
    } else {
      const created = await menu.createCategory({
        name: category.name,
        slug: category.slug,
        description: null,
        sortOrder: category.sortOrder,
        isSecret: category.secret,
      });
      categoryId = created.id;
    }
    for (const [index, sku] of category.skus.entries()) {
      const dishId = dishIds.get(sku);
      if (dishId === undefined) {
        throw new Error(`seed dish missing: ${sku}`);
      }
      const existing = await prisma.menuItem.findFirst({ where: { categoryId, dishId } });
      if (existing === null) {
        await menu.addPlacement(categoryId, { dishId, sortOrder: index });
      }
    }
    if (category.name === 'Seasonal') {
      await menu.setCategoryActive(categoryId, false);
    }
  }
  const bowls = await prisma.menuCategory.findUnique({ where: { slug: 'bowls' } });
  const quinoa = dishIds.get('COL-401');
  if (bowls !== null && quinoa !== undefined) {
    const item = await prisma.menuItem.findFirst({
      where: { categoryId: bowls.id, dishId: quinoa },
    });
    if (item !== null && item.isActive) {
      await menu.updatePlacement(item.id, { isActive: false });
    }
  }
  const desserts = await prisma.menuCategory.findUnique({ where: { slug: 'desserts' } });
  const gulab = dishIds.get('DST-301');
  const initechId = companyIds.get('Initech Labs');
  const globexId = companyIds.get('Globex Logistics');
  if (desserts !== null && gulab !== undefined && initechId !== undefined) {
    const item = await prisma.menuItem.findFirst({
      where: { categoryId: desserts.id, dishId: gulab },
    });
    if (item !== null) {
      const current = await prisma.companyHiddenItem.findMany({
        where: { companyId: initechId },
        select: { menuItemId: true },
      });
      const ids = new Set(current.map((row) => row.menuItemId));
      ids.add(item.id);
      await companies.setHiddenItems(initechId, { ids: [...ids] });
    }
  }
  if (desserts !== null && globexId !== undefined) {
    const current = await prisma.companyHiddenCategory.findMany({
      where: { companyId: globexId },
      select: { categoryId: true },
    });
    const ids = new Set(current.map((row) => row.categoryId));
    ids.add(desserts.id);
    await companies.setHiddenCategories(globexId, { ids: [...ids] });
  }
  logAction(logger, 'seed.menu.done', {});
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
