import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { getEnv } from '../config/env.js';

/**
 * The only PrismaClient in the API. Runtime traffic goes through
 * the pooled DATABASE_URL. Tests pass an explicit connection
 * string (TEST_DATABASE_URL) so they never touch runtime data.
 * Constructed manually in Vitest (`new PrismaService(url)`);
 * Nest DI supplies no arg, so the env default applies.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Optional() connectionString?: string) {
    super({
      adapter: new PrismaPg({
        connectionString: connectionString ?? getEnv().DATABASE_URL,
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
