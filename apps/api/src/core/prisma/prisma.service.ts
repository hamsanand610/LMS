import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { APP_CONFIG, type AppConfig } from '../config/env.js';

/** Single PrismaClient instance per process (one connection pool). */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    const adapter = new PrismaPg({
      connectionString: config.DATABASE_URL,
      max: config.DATABASE_POOL_MAX,
    });
    super({
      adapter,
      log: config.APP_ENV === 'local' ? ['warn', 'error'] : ['error'],
      // A list and its count run as one transaction, which waits for a connection of its own.
      // Two seconds (the default) is too short under a burst of page loads; queue a little longer
      // rather than fail the request.
      transactionOptions: { maxWait: 10_000 },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
