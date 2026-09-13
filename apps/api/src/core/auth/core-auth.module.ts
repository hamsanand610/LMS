import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard.js';
import { AuthContextService } from './auth-context.service.js';
import { AuthGuard } from './auth.guard.js';
import { CsrfGuard } from './csrf.guard.js';
import { ModuleEnabledGuard } from './module-enabled.guard.js';
import { PermissionGuard } from './permission.guard.js';

/**
 * Registers the global guard chain in order:
 * rate limit → authentication → CSRF (cookie sessions) → module enabled → permission.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.JWT_ACCESS_SECRET,
        signOptions: { expiresIn: config.JWT_ACCESS_TTL_SECONDS, issuer: 'lms-api' },
        verifyOptions: { issuer: 'lms-api' },
      }),
    }),
  ],
  providers: [
    AuthContextService,
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: ModuleEnabledGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  exports: [AuthContextService, JwtModule],
})
export class CoreAuthModule {}
