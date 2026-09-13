import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { emailSchema, mobileSchema, paginationQuerySchema } from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { UsersService } from './users.service.js';

const listQuerySchema = paginationQuerySchema.extend({
  role: z.string().max(64).optional(),
  status: z.enum(['invited', 'active', 'suspended', 'deactivated']).optional(),
});

const inviteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  mobile: mobileSchema.optional().nullable(),
  roleKeys: z.array(z.string().min(2).max(64)).min(1).max(6),
});

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  mobile: mobileSchema.optional().nullable(),
});

const rolesSchema = z.object({ roleKeys: z.array(z.string().min(2).max(64)).min(1).max(6) });
const reasonSchema = z.object({ reason: z.string().trim().max(240).default('') });
const idSchema = z.uuid();

@ApiTags('users')
@Controller('users')
@ModuleScope('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @RequirePermission('users:read')
  @Get()
  list(@Query({ schema: listQuerySchema }) query: z.infer<typeof listQuerySchema>) {
    return this.users.list(query);
  }

  @RequirePermission('users:manage')
  @Post()
  invite(
    @Body({ schema: inviteSchema }) body: z.infer<typeof inviteSchema>,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.invite(body, actor);
  }

  @RequirePermission('users:read')
  @Get(':id')
  get(@Param('id', { schema: idSchema }) id: string) {
    return this.users.get(id);
  }

  @RequirePermission('users:manage')
  @Patch(':id')
  update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: updateSchema }) body: z.infer<typeof updateSchema>,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.update(id, body, actor);
  }

  @RequirePermission('users:manage')
  @Post(':id/deactivate')
  @HttpCode(204)
  async deactivate(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: reasonSchema }) body: z.infer<typeof reasonSchema>,
    @CurrentUser() actor: AuthUser,
  ): Promise<void> {
    await this.users.deactivate(id, body.reason, actor);
  }

  @RequirePermission('users:manage')
  @Post(':id/reactivate')
  @HttpCode(204)
  async reactivate(
    @Param('id', { schema: idSchema }) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<void> {
    await this.users.reactivate(id, actor);
  }

  @RequirePermission('users:manage')
  @Put(':id/roles')
  setRoles(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: rolesSchema }) body: z.infer<typeof rolesSchema>,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.setRoles(id, body.roleKeys, actor);
  }

  @RequirePermission('users:manage')
  @Post(':id/invitations/resend')
  @HttpCode(202)
  resend(@Param('id', { schema: idSchema }) id: string, @CurrentUser() actor: AuthUser) {
    return this.users.resendInvitation(id, actor);
  }
}
