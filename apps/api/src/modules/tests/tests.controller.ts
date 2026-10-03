import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  attemptAnswersSchema,
  attemptGradeSchema,
  attemptSubmitSchema,
  integrityEventSchema,
  runInputSchema,
  testCreateSchema,
  testListQuerySchema,
  testPaperSchema,
  testGradingQuerySchema,
  testScheduleSchema,
  testScheduleUpdateSchema,
  testUpdateSchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { RateLimit } from '../../core/rate-limit/rate-limit.decorator.js';
import { AttemptsService } from './attempts.service.js';
import { TestsService } from './tests.service.js';
import { ReadsNotices } from '../notifications/index.js';

const idSchema = z.uuid();
const statusSchema = z.object({ status: z.enum(['draft', 'published', 'archived']) });

@ApiTags('tests')
@Controller('tests')
@ModuleScope('tests')
export class TestsController {
  constructor(
    private readonly tests: TestsService,
    private readonly attempts: AttemptsService,
  ) {}

  @RequirePermission('tests:manage')
  @Get()
  list(
    @Query({ schema: testListQuerySchema }) query: z.infer<typeof testListQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tests.list(query, user);
  }

  @RequirePermission('tests:manage')
  @Post()
  create(
    @Body({ schema: testCreateSchema }) body: z.infer<typeof testCreateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tests.create(body, user);
  }

  @RequirePermission('tests:manage')
  @Get(':id')
  get(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.tests.get(id, user);
  }

  @RequirePermission('tests:manage')
  @Patch(':id')
  update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: testUpdateSchema }) body: z.infer<typeof testUpdateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tests.update(id, body, user);
  }

  @RequirePermission('tests:manage')
  @Put(':id/paper')
  savePaper(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: testPaperSchema }) body: z.infer<typeof testPaperSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tests.savePaper(id, body, user);
  }

  @RequirePermission('tests:manage')
  @Post(':id/status')
  setStatus(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: statusSchema }) body: z.infer<typeof statusSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tests.setStatus(id, body.status, user);
  }

  @RequirePermission('tests:manage')
  @Get(':id/schedules')
  schedules(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.tests.schedules(id, user);
  }

  @RequirePermission('tests:schedule')
  @Post(':id/schedules')
  schedule(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: testScheduleSchema }) body: z.infer<typeof testScheduleSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tests.schedule(id, body, user);
  }

  @RequirePermission('tests:schedule')
  @Patch(':id/schedules/:scheduleId')
  updateSchedule(
    @Param('id', { schema: idSchema }) id: string,
    @Param('scheduleId', { schema: idSchema }) scheduleId: string,
    @Body({ schema: testScheduleUpdateSchema }) body: z.infer<typeof testScheduleUpdateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tests.updateSchedule(id, scheduleId, body, user);
  }

  @RequirePermission('tests:schedule')
  @Delete(':id/schedules/:scheduleId')
  unschedule(
    @Param('id', { schema: idSchema }) id: string,
    @Param('scheduleId', { schema: idSchema }) scheduleId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tests.unschedule(id, scheduleId, user);
  }

  /** Everyone's marks for one window: staff only, a learner's own-scope read never reaches it. */
  @RequirePermission('tests:read', { minScope: 'batch' })
  @Get(':id/schedules/:scheduleId/results')
  results(
    @Param('id', { schema: idSchema }) id: string,
    @Param('scheduleId', { schema: idSchema }) scheduleId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tests.results(id, scheduleId, user);
  }

  @RequirePermission('tests:release')
  @Post(':id/schedules/:scheduleId/release')
  release(
    @Param('id', { schema: idSchema }) id: string,
    @Param('scheduleId', { schema: idSchema }) scheduleId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tests.release(id, scheduleId, user);
  }

  @RequirePermission('tests:monitor')
  @Get(':id/schedules/:scheduleId/monitor')
  monitor(
    @Param('id', { schema: idSchema }) id: string,
    @Param('scheduleId', { schema: idSchema }) scheduleId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tests.monitor(id, scheduleId, user);
  }

  @RequirePermission('tests:grade')
  @Get(':id/grading/queue')
  gradingQueue(
    @Param('id', { schema: idSchema }) id: string,
    @Query({ schema: testGradingQuerySchema }) query: z.infer<typeof testGradingQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attempts.gradingQueue(id, user, query.state);
  }

  /** Starts a sitting, or hands back the one already open. */
  @RequirePermission('tests:attempt')
  @Post(':id/attempts')
  start(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.attempts.start(id, user);
  }
}

@ApiTags('tests')
@Controller('attempts')
@ModuleScope('tests')
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @RequirePermission('tests:attempt')
  @Get(':id/state')
  state(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.attempts.state(id, user);
  }

  @RequirePermission('tests:attempt')
  @Patch(':id/answers')
  save(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: attemptAnswersSchema }) body: z.infer<typeof attemptAnswersSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attempts.saveAnswers(id, body, user);
  }

  /** Runs a coding answer on the visible cases or the learner's own input. Nothing is recorded. */
  @RequirePermission('tests:attempt')
  @RateLimit({ points: 40, durationSec: 300, keyBy: 'user' })
  @Post(':id/questions/:testQuestionId/run')
  @HttpCode(200)
  run(
    @Param('id', { schema: idSchema }) id: string,
    @Param('testQuestionId', { schema: idSchema }) testQuestionId: string,
    @Body({ schema: runInputSchema }) body: z.infer<typeof runInputSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attempts.run(id, testQuestionId, body, user);
  }

  @RequirePermission('tests:attempt')
  @Post(':id/events')
  event(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: integrityEventSchema }) body: z.infer<typeof integrityEventSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attempts.recordIntegrityEvent(id, body, user);
  }

  @RequirePermission('tests:attempt')
  @Post(':id/submit')
  submit(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: attemptSubmitSchema }) _body: z.infer<typeof attemptSubmitSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attempts.submit(id, user);
  }

  @RequirePermission('tests:read')
  @ReadsNotices(({ body }) => `/tests/${(body as { testId: string }).testId}/result`)
  @Get(':id/result')
  result(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.attempts.result(id, user);
  }

  @RequirePermission('tests:grade')
  @Patch(':id/answers/:answerId/grade')
  grade(
    @Param('id', { schema: idSchema }) id: string,
    @Param('answerId', { schema: idSchema }) answerId: string,
    @Body({ schema: attemptGradeSchema }) body: z.infer<typeof attemptGradeSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attempts.gradeAnswer(id, answerId, body, user);
  }
}

@ApiTags('tests')
@Controller('me')
@ModuleScope('tests')
export class MyTestsController {
  constructor(private readonly attempts: AttemptsService) {}

  /** The learner's own tests: upcoming, live and finished. */
  @RequirePermission('tests:read')
  @ReadsNotices('/tests')
  @Get('tests')
  mine(@CurrentUser() user: AuthUser) {
    return this.attempts.mine(user);
  }
}
