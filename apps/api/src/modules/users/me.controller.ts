import { Body, Controller, Get, HttpCode, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { AuthenticatedOnly, CurrentUser } from '../../core/auth/decorators.js';
import { MeService } from './me.service.js';
import { UsersService } from './users.service.js';

const updateMeSchema = z.object({ name: z.string().trim().min(2).max(120).optional() });

@ApiTags('me')
@Controller('me')
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly users: UsersService,
  ) {}

  /** Everything the web shell needs after sign-in: identity, roles, permissions, flags, navigation, branding. */
  @AuthenticatedOnly()
  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.me.build(user);
  }

  @AuthenticatedOnly()
  @Patch()
  @HttpCode(204)
  async update(
    @CurrentUser() user: AuthUser,
    @Body({ schema: updateMeSchema }) body: z.infer<typeof updateMeSchema>,
  ): Promise<void> {
    await this.users.updateOwnProfile(user.id, body);
  }
}
