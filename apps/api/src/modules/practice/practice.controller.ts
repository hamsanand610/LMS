import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  labDraftQuerySchema,
  labDraftSchema,
  playgroundRunSchema,
  practiceListQuerySchema,
  practiceRunSchema,
  practiceSubmitSchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { RateLimit } from '../../core/rate-limit/rate-limit.decorator.js';
import { LabDraftsService } from './lab-drafts.service.js';
import { PlaygroundService } from './playground.service.js';
import { PracticeService } from './practice.service.js';

const slugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Not a lab address');
const idSchema = z.uuid();

/**
 * The learner's side of Labs (ADR-0018): the catalogue, a lab's workspace, the playground and
 * drafts. Every route is the learner's own; runs and submissions are rate-limited per person and
 * run one at a time (ADR-0021).
 */
@ApiTags('practice')
@Controller('practice')
@ModuleScope('practice')
export class PracticeController {
  constructor(
    private readonly practice: PracticeService,
    private readonly playground: PlaygroundService,
    private readonly drafts: LabDraftsService,
  ) {}

  /** Whether code can be run here, and in which runtimes. */
  @RequirePermission('practice:use')
  @Get('driver')
  driver() {
    return this.practice.driverInfo();
  }

  @RequirePermission('practice:use')
  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.practice.summary(user);
  }

  /** Labs the learner started and has not solved, for "continue where you left off". */
  @RequirePermission('practice:use')
  @Get('in-progress')
  inProgress(@CurrentUser() user: AuthUser) {
    return this.practice.inProgress(user);
  }

  @RequirePermission('practice:use')
  @Get('problems')
  list(
    @Query({ schema: practiceListQuerySchema }) query: z.infer<typeof practiceListQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.practice.list(query, user);
  }

  @RequirePermission('practice:use')
  @Get('problems/:slug')
  get(@Param('slug', { schema: slugSchema }) slug: string, @CurrentUser() user: AuthUser) {
    return this.practice.get(slug, user);
  }

  @RequirePermission('practice:use')
  @Get('problems/:slug/submissions')
  submissions(@Param('slug', { schema: slugSchema }) slug: string, @CurrentUser() user: AuthUser) {
    return this.practice.submissions(slug, user);
  }

  /** One of the learner's own submissions, with its code. */
  @RequirePermission('practice:use')
  @Get('problems/:slug/submissions/:id')
  submission(
    @Param('slug', { schema: slugSchema }) slug: string,
    @Param('id', { schema: idSchema }) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.practice.submission(slug, id, user);
  }

  /** Runs are cheap for the learner and not for the sandbox, so they are counted per person. */
  @RequirePermission('practice:use')
  @RateLimit({ points: 30, durationSec: 300, keyBy: 'user' })
  @Post('problems/:slug/run')
  @HttpCode(200)
  run(
    @Param('slug', { schema: slugSchema }) slug: string,
    @Body({ schema: practiceRunSchema }) body: z.infer<typeof practiceRunSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.practice.run(slug, body, user);
  }

  @RequirePermission('practice:use')
  @RateLimit({ points: 20, durationSec: 300, keyBy: 'user' })
  @Post('problems/:slug/submissions')
  submit(
    @Param('slug', { schema: slugSchema }) slug: string,
    @Body({ schema: practiceSubmitSchema }) body: z.infer<typeof practiceSubmitSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.practice.submit(slug, body, user);
  }

  /** The code playground: any code language the sandbox offers, on the learner's own input. */
  @RequirePermission('practice:use')
  @RateLimit({ points: 30, durationSec: 300, keyBy: 'user' })
  @Post('playground/run')
  @HttpCode(200)
  playgroundRun(
    @Body({ schema: playgroundRunSchema }) body: z.infer<typeof playgroundRunSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.playground.run(body, user);
  }

  @RequirePermission('practice:use')
  @Get('drafts')
  listDrafts(
    @Query({ schema: labDraftQuerySchema }) query: z.infer<typeof labDraftQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.drafts.list(query.scope, query.language, user);
  }

  /** Autosave: often enough to lose nothing, limited so it cannot be used to flood the store. */
  @RequirePermission('practice:use')
  @RateLimit({ points: 120, durationSec: 300, keyBy: 'user' })
  @Put('drafts')
  saveDraft(
    @Body({ schema: labDraftSchema }) body: z.infer<typeof labDraftSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.drafts.save(body, user);
  }

  @RequirePermission('practice:use')
  @Delete('drafts')
  @HttpCode(204)
  async removeDraft(
    @Query({ schema: labDraftQuerySchema }) query: z.infer<typeof labDraftQuerySchema>,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.drafts.remove(query.scope, query.language, user);
  }
}
