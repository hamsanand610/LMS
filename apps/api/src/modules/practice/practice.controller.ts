import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { practiceListQuerySchema, practiceRunSchema, practiceSubmitSchema } from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { RateLimit } from '../../core/rate-limit/rate-limit.decorator.js';
import { PracticeService } from './practice.service.js';

const slugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Not a problem address');

@ApiTags('practice')
@Controller('practice')
@ModuleScope('practice')
export class PracticeController {
  constructor(private readonly practice: PracticeService) {}

  /** Whether code can be run here, and in which languages. */
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
}
