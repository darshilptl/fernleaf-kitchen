import type { PrismaClient } from '@prisma/client';

/**
 * Test-database helpers. Every spec file calls `truncateAll`
 * (usually in beforeEach) so specs never leak rows to each other.
 * Files run serially (`fileParallelism: false`) because they
 * share this one database.
 */
export function requireTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (url === undefined || url === '') {
    throw new Error('TEST_DATABASE_URL is not set in apps/api/.env');
  }
  if (url === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL');
  }
  return url;
}

const BUSINESS_TABLES = [
  '"order_events"',
  '"order_combination_choices"',
  '"order_line_combinations"',
  '"order_lines"',
  '"orders"',
  '"invoices"',
  '"company_hidden_items"',
  '"company_hidden_categories"',
  '"menu_items"',
  '"menu_categories"',
  '"employees"',
  '"employee_allergens"',
  '"employee_dietary_tags"',
  '"company_holidays"',
  '"company_addresses"',
  '"company_email_domains"',
  '"companies"',
  '"dish_tier_prices"',
  '"option_tier_prices"',
  '"price_tiers"',
  '"option_group_portions"',
  '"option_group_options"',
  '"option_groups"',
  '"option_portions"',
  '"options"',
  '"option_allergens"',
  '"option_dietary_tags"',
  '"dish_allergens"',
  '"dish_dietary_tags"',
  '"dishes"',
  '"allergens"',
  '"dietary_tags"',
  '"kitchen_stations"',
  '"portion_sizes"',
  '"packaging_types"',
  '"kitchen_holidays"',
  '"role_permissions"',
  '"staff_users"',
  '"roles"',
  '"platform_settings"',
].join(', ');

export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${BUSINESS_TABLES} RESTART IDENTITY CASCADE`,
  );
}
