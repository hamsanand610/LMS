import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  labAttemptsQuerySchema,
  labListQuerySchema,
  practiceCatalogueSchema,
  practiceRunSchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { RateLimit } from '../../core/rate-limit/rate-limit.decorator.js';
import { LabsStaffService } from './labs-staff.service.js';

const idSchema = z.uuid();

/**
 * Labs for staff (ADR-0018): the labs they wrote or manage, a preview exactly as a learner sees
 * it, the catalogue, and learners' attempts within the reviewer's scope.
 */
@ApiTags('practice')
@Controller('practice')
@ModuleScope('practice')
export class LabsStaffController {
  constructor(private readonly labs: LabsStaffService) {}

  @RequirePermission('questions:read')
  @Get('labs')
  list(
    @Query({ schema: labListQuerySchema }) query: z.infer<typeof labListQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.labs.list(query, user);
  }

  @RequirePermission('questions:read')
  @Get('labs/:id/preview')
  preview(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.labs.preview(id, user);
  }

  @RequirePermission('questions:read')
  @RateLimit({ points: 30, durationSec: 300, keyBy: 'user' })
  @Post('labs/:id/preview/run')
  @HttpCode(200)
  previewRun(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: practiceRunSchema }) body: z.infer<typeof practiceRunSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.labs.previewRun(id, body, user);
  }

  /** Into the Labs catalogue or out of it: an author, for their own labs; a manager, for any. */
  @RequirePermission('practice:publish_own')
  @Post('labs/:id/catalogue')
  @HttpCode(200)
  catalogue(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: practiceCatalogueSchema }) body: z.infer<typeof practiceCatalogueSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.labs.setCatalogue(id, body, user);
  }

  @RequirePermission('practice:review')
  @Get('labs/:id/attempts')
  attempts(
    @Param('id', { schema: idSchema }) id: string,
    @Query({ schema: labAttemptsQuerySchema }) query: z.infer<typeof labAttemptsQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.labs.attempts(id, query, user);
  }

  @RequirePermission('practice:review')
  @Get('runs/:id')
  run(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.labs.run(id, user);
  }
}
