import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { paginationQuerySchema, type PermissionScope } from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import {
  CurrentUser,
  EffectiveScope,
  ModuleScope,
  RequirePermission,
} from '../../core/auth/decorators.js';
import { AuditQueryService } from './audit-query.service.js';

const auditQuerySchema = paginationQuerySchema.extend({
  actorId: z.uuid().optional(),
  action: z.string().max(80).optional(),
  resourceType: z.string().max(60).optional(),
  resourceId: z.string().max(64).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

@ApiTags('audit')
@Controller('audit-logs')
@ModuleScope('audit')
export class AuditController {
  constructor(private readonly audit: AuditQueryService) {}

  @RequirePermission('audit:read')
  @Get()
  list(
    @Query({ schema: auditQuerySchema }) query: z.infer<typeof auditQuerySchema>,
    @CurrentUser() user: AuthUser,
    @EffectiveScope() scope: PermissionScope,
  ) {
    return this.audit.list({ ...query, actorId: scope === 'own' ? user.id : query.actorId });
  }
}
