import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  feedbackFormCreateSchema,
  feedbackListQuerySchema,
  feedbackResponseSchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { RateLimit } from '../../core/rate-limit/rate-limit.decorator.js';
import { FeedbackService } from './feedback.service.js';

const idSchema = z.uuid();
const periodQuerySchema = z.object({
  period: z
    .string()
    .regex(/^(once|\d{4}-\d{2}-\d{2})$/)
    .optional(),
});

/** Forms and their figures, for administrators and for the trainer a form is about. */
@ApiTags('feedback')
@Controller('feedback/forms')
@ModuleScope('feedback')
export class FeedbackFormsController {
  constructor(private readonly feedback: FeedbackService) {}

  @RequirePermission('feedback:read')
  @Get()
  list(
    @Query({ schema: feedbackListQuerySchema }) query: z.infer<typeof feedbackListQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feedback.list(query, user);
  }

  @RequirePermission('feedback:manage')
  @Post()
  create(
    @Body({ schema: feedbackFormCreateSchema }) body: z.infer<typeof feedbackFormCreateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feedback.create(body, user);
  }

  @RequirePermission('feedback:read')
  @Get(':id')
  get(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.feedback.get(id, user);
  }

  @RequirePermission('feedback:manage')
  @Post(':id/close')
  close(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.feedback.close(id, user);
  }

  /** One round's figures; nothing but counts below five answers (D10). */
  @RequirePermission('feedback:read')
  @Get(':id/results')
  results(
    @Param('id', { schema: idSchema }) id: string,
    @Query({ schema: periodQuerySchema }) query: z.infer<typeof periodQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feedback.results(id, user, query.period);
  }
}

/** A learner's open forms, and their answers. */
@ApiTags('feedback')
@Controller('me/feedback')
@ModuleScope('feedback')
export class MyFeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @RequirePermission('feedback:respond')
  @Get()
  mine(@CurrentUser() user: AuthUser) {
    return this.feedback.mine(user);
  }

  @RequirePermission('feedback:respond')
  @RateLimit({ points: 30, durationSec: 3600, keyBy: 'user' })
  @Post(':id/responses')
  respond(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: feedbackResponseSchema }) body: z.infer<typeof feedbackResponseSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feedback.respond(id, body.answers, user);
  }
}
