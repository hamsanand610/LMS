import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { practiceListQuerySchema, practiceRunSchema, practiceSubmitSchema } from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
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

  /** Which driver will run the code, and whether the browser has to do it. */
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

  /** The sample cases the workspace runs against. */
  @RequirePermission('practice:use')
  @Get('problems/:slug/samples')
  samples(@Param('slug', { schema: slugSchema }) slug: string) {
    return this.practice.samples(slug);
  }

  /** Every case a submission is marked against; see the note on the service method. */
  @RequirePermission('practice:use')
  @Get('problems/:slug/cases')
  cases(@Param('slug', { schema: slugSchema }) slug: string) {
    return this.practice.gradingCases(slug);
  }

  @RequirePermission('practice:use')
  @Get('problems/:slug/submissions')
  submissions(@Param('slug', { schema: slugSchema }) slug: string, @CurrentUser() user: AuthUser) {
    return this.practice.submissions(slug, user);
  }

  @RequirePermission('practice:use')
  @Post('problems/:slug/run')
  run(
    @Param('slug', { schema: slugSchema }) slug: string,
    @Body({ schema: practiceRunSchema }) body: z.infer<typeof practiceRunSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.practice.run(slug, body, user);
  }

  @RequirePermission('practice:use')
  @Post('problems/:slug/submissions')
  submit(
    @Param('slug', { schema: slugSchema }) slug: string,
    @Body({ schema: practiceSubmitSchema }) body: z.infer<typeof practiceSubmitSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.practice.submit(slug, body, user);
  }
}
