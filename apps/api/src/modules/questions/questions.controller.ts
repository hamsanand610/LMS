import { Body, Controller, Delete, Get, Header, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  practiceCatalogueSchema,
  questionCreateSchema,
  questionImportSchema,
  questionListQuerySchema,
  questionStatusSchema,
  questionUpdateSchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { QuestionImportService } from './import.service.js';
import { QuestionsService } from './questions.service.js';
import { RateLimit } from '../../core/rate-limit/rate-limit.decorator.js';

const idSchema = z.uuid();

@ApiTags('questions')
@Controller('questions')
@ModuleScope('questions')
export class QuestionsController {
  constructor(
    private readonly questions: QuestionsService,
    private readonly imports: QuestionImportService,
  ) {}

  @RequirePermission('questions:read')
  @Get()
  list(
    @Query({ schema: questionListQuerySchema }) query: z.infer<typeof questionListQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.questions.list(query, user);
  }

  /** The sheet an author fills in before importing. */
  @RequirePermission('questions:import')
  @Get('import/template')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="question-import-template.csv"')
  template() {
    return this.imports.template();
  }

  @RequirePermission('questions:import')
  @RateLimit({ points: 10, durationSec: 600, keyBy: 'user' })
  @Post('import')
  importSheet(
    @Body({ schema: questionImportSchema }) body: z.infer<typeof questionImportSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.imports.import(
      body.content,
      { dryRun: body.dryRun, publish: body.publish, encoding: body.encoding },
      user,
    );
  }

  @RequirePermission('questions:read')
  @Get(':id')
  get(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.questions.get(id, user);
  }

  @RequirePermission('questions:read')
  @Get(':id/versions')
  versions(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.questions.versions(id, user);
  }

  @RequirePermission('questions:create_own')
  @Post()
  create(
    @Body({ schema: questionCreateSchema }) body: z.infer<typeof questionCreateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.questions.create(body, user);
  }

  /** A full replacement: the editor always sends the whole question, options and all. */
  @RequirePermission('questions:create_own')
  @Put(':id')
  update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: questionUpdateSchema }) body: z.infer<typeof questionUpdateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.questions.update(id, body, user);
  }

  @RequirePermission('questions:create_own')
  @Post(':id/status')
  setStatus(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: questionStatusSchema }) body: z.infer<typeof questionStatusSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.questions.setStatus(id, body.status, user);
  }

  /**
   * Runs the reference solutions against the cases in the sandbox (and, for SQL, works out the
   * expected tables left blank). A browser's report is no longer accepted (ADR-0016).
   */
  /** Runs code in the sandbox: one at a time per person (ExecutionGate) and 30 in 10 minutes. */
  @RequirePermission('questions:create_own')
  @RateLimit({ points: 30, durationSec: 600, keyBy: 'user' })
  @Post(':id/validate')
  validate(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.questions.validate(id, user);
  }

  @RequirePermission('practice:manage')
  @Post(':id/practice')
  setPractice(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: practiceCatalogueSchema }) body: z.infer<typeof practiceCatalogueSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.questions.setPractice(id, body, user);
  }

  @RequirePermission('questions:manage')
  @Delete(':id')
  remove(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.questions.remove(id, user);
  }
}
