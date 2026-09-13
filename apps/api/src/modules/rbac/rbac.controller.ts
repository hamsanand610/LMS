import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PERMISSION_SCOPES } from '@lms/shared';
import { ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { RbacService } from './rbac.service.js';

const createRoleSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/, 'Use lowercase letters, digits and underscores'),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  cloneFromRoleId: z.uuid().optional(),
});

const updateRoleSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(240).optional(),
});

const bundleSchema = z
  .array(z.object({ permissionKey: z.string().min(3).max(80), scope: z.enum(PERMISSION_SCOPES) }))
  .max(500);

@ApiTags('rbac')
@Controller()
@ModuleScope('rbac')
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @RequirePermission('roles:read')
  @Get('roles')
  listRoles() {
    return this.rbac.listRoles();
  }

  @RequirePermission('roles:manage')
  @Post('roles')
  createRole(@Body({ schema: createRoleSchema }) body: z.infer<typeof createRoleSchema>) {
    return this.rbac.createRole(body);
  }

  @RequirePermission('roles:manage')
  @Patch('roles/:id')
  async updateRole(
    @Param('id', { schema: z.uuid() }) id: string,
    @Body({ schema: updateRoleSchema }) body: z.infer<typeof updateRoleSchema>,
  ) {
    await this.rbac.updateRole(id, body);
    return { ok: true };
  }

  @RequirePermission('roles:read')
  @Get('roles/:id/permissions')
  rolePermissions(@Param('id', { schema: z.uuid() }) id: string) {
    return this.rbac.getRolePermissions(id);
  }

  @RequirePermission('roles:manage')
  @Put('roles/:id/permissions')
  setRolePermissions(
    @Param('id', { schema: z.uuid() }) id: string,
    @Body({ schema: bundleSchema }) body: z.infer<typeof bundleSchema>,
  ) {
    return this.rbac.setRolePermissions(id, body);
  }

  @RequirePermission('roles:read')
  @Get('permissions')
  permissions() {
    return this.rbac.listPermissions();
  }
}
