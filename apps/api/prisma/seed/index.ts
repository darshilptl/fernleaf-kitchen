import { PrismaService } from '../../src/database/prisma.service.js';
import { seedPart1 } from './part-1.js';

/**
 * Prisma seed entry (`pnpm --filter api db:seed`). Runs part 1
 * now; Group 5 appends part 2 (orders, invoices, dashboards
 * data) plus the boot hook here. Never run against a database
 * holding reviewer data without explicit approval.
 */
async function main(): Promise<void> {
  const prisma = new PrismaService();
  try {
    await seedPart1(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
