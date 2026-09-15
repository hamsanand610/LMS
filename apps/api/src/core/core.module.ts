import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CoreAuditModule } from './audit/audit.module.js';
import { CoreAuthModule } from './auth/core-auth.module.js';
import { ConfigModule } from './config/config.module.js';
import { EmailModule } from './email/email.module.js';
import { RequestContextMiddleware } from './http/request-context.js';
import { LoggerModule } from './logging/logger.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { QueueModule } from './queue/queue.module.js';
import { ScopeModule } from './scope/scope.module.js';
import { SheetsModule } from './sheets/sheets.module.js';
import { StorageModule } from './storage/storage.module.js';
import { TenantModule } from './tenant/tenant.module.js';

/** Cross-cutting infrastructure shared by every feature module. */
@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    PrismaModule,
    TenantModule,
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.', maxListeners: 50 }),
    QueueModule,
    StorageModule,
    EmailModule,
    CoreAuditModule,
    ScopeModule,
    SheetsModule,
    CoreAuthModule,
  ],
})
export class CoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('{*path}');
  }
}
