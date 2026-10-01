import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  doubtCreateSchema,
  doubtListQuerySchema,
  doubtReplySchema,
  doubtStatusSchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { DoubtsService } from './doubts.service.js';

const idSchema = z.uuid();

/** A learner's own doubts: ask, follow the thread, write back, resolve or reopen. */
@ApiTags('doubts')
@Controller('me/doubts')
@ModuleScope('doubts')
export class MeDoubtsController {
  constructor(private readonly doubts: DoubtsService) {}

  @RequirePermission('doubts:ask')
  @Get()
  list(
    @Query({ schema: doubtListQuerySchema }) query: z.infer<typeof doubtListQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.doubts.list(user, 'learner', query);
  }

  @RequirePermission('doubts:ask')
  @Get(':id')
  get(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.doubts.get(id, user, 'learner');
  }

  @RequirePermission('doubts:ask')
  @Post()
  create(
    @Body({ schema: doubtCreateSchema }) body: z.infer<typeof doubtCreateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.doubts.create(body, user);
  }

  @RequirePermission('doubts:ask')
  @Post(':id/replies')
  reply(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: doubtReplySchema }) body: z.infer<typeof doubtReplySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.doubts.reply(id, body.body, user, 'learner');
  }

  @RequirePermission('doubts:ask')
  @Post(':id/status')
  @HttpCode(200)
  setStatus(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: doubtStatusSchema }) body: z.infer<typeof doubtStatusSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.doubts.setStatus(id, body.status, user, 'learner');
  }
}

/** The staff queue: a trainer sees their batches' learners, an administrator everybody's. */
@ApiTags('doubts')
@Controller('doubts')
@ModuleScope('doubts')
export class DoubtsController {
  constructor(private readonly doubts: DoubtsService) {}

  @RequirePermission('doubts:answer')
  @Get()
  list(
    @Query({ schema: doubtListQuerySchema }) query: z.infer<typeof doubtListQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.doubts.list(user, 'staff', query);
  }

  @RequirePermission('doubts:answer')
  @Get(':id')
  get(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.doubts.get(id, user, 'staff');
  }

  @RequirePermission('doubts:answer')
  @Post(':id/replies')
  reply(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: doubtReplySchema }) body: z.infer<typeof doubtReplySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.doubts.reply(id, body.body, user, 'staff');
  }

  @RequirePermission('doubts:answer')
  @Post(':id/status')
  @HttpCode(200)
  setStatus(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: doubtStatusSchema }) body: z.infer<typeof doubtStatusSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.doubts.setStatus(id, body.status, user, 'staff');
  }
}
