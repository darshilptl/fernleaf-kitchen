import { PrismaService } from '../../src/database/prisma.service.js';
import { seedPart1 } from './part-1.js';
import { seedPart2 } from './part-2.js';

/**
 * Prisma seed entry (`pnpm --filter api db:seed`). Part 1 lays the
 * catalogue, pricing, companies and menu; part 2 adds demo orders,
 * driver drops and invoices. Both idempotent; never run against a
 * database holding reviewer data without explicit approval.
 */
async function main(): Promise<void> {
  const prisma = new PrismaService();
  try {
    await seedPart1(prisma);
    await seedPart2(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
