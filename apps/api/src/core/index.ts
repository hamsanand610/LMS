// Public surface of the core for feature modules (import from '../../core/index.js').
export { APP_CONFIG, type AppConfig } from './config/env.js';
export { PrismaService } from './prisma/prisma.service.js';
export { TenantService, type OrganizationContext } from './tenant/tenant.service.js';
export { AuditService, type AuditEntry } from './audit/audit.service.js';
export { JobsService } from './queue/jobs.service.js';
export { SheetsService, type SheetColumn, type ParsedSheet } from './sheets/sheets.service.js';
export { EmailService } from './email/email.service.js';
export * as emailTemplates from './email/templates.js';
export {
  STORAGE_DRIVER,
  type StorageDriver,
  type Bucket,
  type PresignedUpload,
} from './storage/storage.driver.js';
export { AuthContextService } from './auth/auth-context.service.js';
export {
  type AuthUser,
  scopeFor,
  hasPermission,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  CSRF_COOKIE,
  CSRF_HEADER,
  type AccessTokenPayload,
} from './auth/auth-user.js';
export {
  Public,
  RequirePermission,
  AuthenticatedOnly,
  ModuleScope,
  CurrentUser,
  EffectiveScope,
} from './auth/decorators.js';
export { RateLimit } from './rate-limit/rate-limit.decorator.js';
export * from './http/errors.js';
export { parseSort, paginate, skipTake } from './http/pagination.js';
export { getRequestContext } from './http/request-context.js';
export { MemoryCache } from './cache/memory-cache.js';
export { ModuleRegistryService } from './registry/module-registry.service.js';
export { ModuleStateService } from './registry/module-state.service.js';
