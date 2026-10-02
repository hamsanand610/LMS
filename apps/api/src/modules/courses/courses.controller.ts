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
  courseCreateSchema,
  courseEnrollmentQuerySchema,
  courseStaffSchema,
  courseListQuerySchema,
  courseUpdateSchema,
  lessonProgressSchema,
  outlineSchema,
  practiceRunSchema,
  practiceSubmitSchema,
  publishSchema,
  recordingSchema,
  submissionInputSchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { RateLimit } from '../../core/rate-limit/rate-limit.decorator.js';
import { LearnerAccessService, ProgressService } from '../progress/index.js';
import { CourseStaffService } from './course-staff.service.js';
import { CoursesService } from './courses.service.js';
import { LessonLabService } from './lesson-lab.service.js';
import { LessonPracticeService } from './lesson-practice.service.js';
import { LessonsService } from './lessons.service.js';
import { RecordingsService } from './recordings.service.js';

const idSchema = z.uuid();

@ApiTags('courses')
@Controller('courses')
@ModuleScope('courses')
export class CoursesController {
  constructor(
    private readonly courses: CoursesService,
    private readonly staff: CourseStaffService,
  ) {}

  @RequirePermission('courses:read')
  @Get()
  list(
    @Query({ schema: courseListQuerySchema }) query: z.infer<typeof courseListQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.courses.list(query, user);
  }

  @RequirePermission('courses:read')
  @Get(':id')
  get(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.courses.get(id, user);
  }

  @RequirePermission('courses:manage')
  @Post()
  create(
    @Body({ schema: courseCreateSchema }) body: z.infer<typeof courseCreateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.courses.create(body, user);
  }

  /** The course's details: its managers, or its staff (ADR-0023). */
  @RequirePermission('courses:author')
  @Patch(':id')
  update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: courseUpdateSchema }) body: z.infer<typeof courseUpdateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.courses.update(id, body, user);
  }

  /** The whole outline in one save, so ordering and nesting stay consistent. */
  @RequirePermission('courses:author')
  @Put(':id/outline')
  saveOutline(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: outlineSchema }) body: z.infer<typeof outlineSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.courses.saveOutline(id, body, user);
  }

  @RequirePermission('courses:manage')
  @Delete(':id')
  archive(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.courses.archive(id, user);
  }

  /** Puts trainers in charge of the course's content (ADR-0023); replaces the list. */
  @RequirePermission('courses:manage')
  @Put(':id/staff')
  setStaff(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: courseStaffSchema }) body: z.infer<typeof courseStaffSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.staff.set(id, body.trainerIds, user);
  }

  /** Everyone enrolled, however they came (D8): administrators, who enrol and withdraw them. */
  @RequirePermission('courses:publish', { minScope: 'all' })
  @Get(':id/enrollments')
  enrollments(
    @Param('id', { schema: idSchema }) id: string,
    @Query({ schema: courseEnrollmentQuerySchema })
    query: z.infer<typeof courseEnrollmentQuerySchema>,
  ) {
    return this.courses.enrolmentsOf(id, query);
  }

  /** Staff only: a learner's own-scope read never lists a course's audiences. */
  @RequirePermission('courses:read', { minScope: 'batch' })
  @Get(':id/publications')
  publications(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.courses.publications(id, user);
  }

  @RequirePermission('courses:publish')
  @Post(':id/publish')
  publish(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: publishSchema }) body: z.infer<typeof publishSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.courses.publish(id, body, user);
  }

  @RequirePermission('courses:publish')
  @Delete(':id/publications/:publicationId')
  unpublish(
    @Param('id', { schema: idSchema }) id: string,
    @Param('publicationId', { schema: idSchema }) publicationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.courses.unpublish(id, publicationId, user);
  }
}

@ApiTags('courses')
@Controller('lessons')
@ModuleScope('courses')
export class LessonsController {
  constructor(
    private readonly lessons: LessonsService,
    private readonly practice: LessonPracticeService,
    private readonly lab: LessonLabService,
  ) {}

  /** The question a practice lesson embeds, as the learner may see it (plan DP-S05). */
  @RequirePermission('courses:read')
  @Get(':id/practice')
  practiceQuestion(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.practice.get(id, user);
  }

  @RequirePermission('courses:read')
  @Post(':id/practice/submissions')
  answerPractice(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: submissionInputSchema }) body: z.infer<typeof submissionInputSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.practice.submit(id, body, user);
  }

  /** The lab a lab lesson opens (ADR-0018): the lesson's access rules, the Labs' sandbox. */
  @RequirePermission('courses:read')
  @Get(':id/lab')
  labGet(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.lab.get(id, user);
  }

  @RequirePermission('courses:read')
  @RateLimit({ points: 30, durationSec: 300, keyBy: 'user' })
  @Post(':id/lab/run')
  @HttpCode(200)
  labRun(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: practiceRunSchema }) body: z.infer<typeof practiceRunSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lab.run(id, body, user);
  }

  @RequirePermission('courses:read')
  @Get(':id/lab/submissions')
  labHistory(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.lab.history(id, user);
  }

  /** A passing submission completes the lesson. */
  @RequirePermission('courses:read')
  @RateLimit({ points: 20, durationSec: 300, keyBy: 'user' })
  @Post(':id/lab/submissions')
  labSubmit(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: practiceSubmitSchema }) body: z.infer<typeof practiceSubmitSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lab.submit(id, body, user);
  }

  @RequirePermission('courses:read')
  @Get(':id/lab/submissions/:runId')
  labSubmission(
    @Param('id', { schema: idSchema }) id: string,
    @Param('runId', { schema: idSchema }) runId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lab.submission(id, runId, user);
  }

  @RequirePermission('courses:read')
  @Get(':id')
  get(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.lessons.get(id, user);
  }

  /** A fresh signed link for the video; the player asks again when the old one expires. */
  @RequirePermission('courses:read')
  @Get(':id/playback')
  playback(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.lessons.playback(id, user);
  }

  @RequirePermission('courses:read')
  @Get(':id/resources/:resourceId/url')
  resourceUrl(
    @Param('id', { schema: idSchema }) id: string,
    @Param('resourceId', { schema: idSchema }) resourceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lessons.resourceUrl(id, resourceId, user);
  }

  /** A playing video reports every 15 seconds; this leaves room for several tabs, and no more. */
  @RequirePermission('progress:read')
  @RateLimit({ points: 120, durationSec: 300, keyBy: 'user' })
  @Post(':id/progress')
  recordProgress(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: lessonProgressSchema }) body: z.infer<typeof lessonProgressSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lessons.recordProgress(id, body, user);
  }

  @RequirePermission('progress:read')
  @RateLimit({ points: 60, durationSec: 300, keyBy: 'user' })
  @Post(':id/complete')
  complete(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.lessons.complete(id, user);
  }
}

@ApiTags('courses')
@Controller('me')
@ModuleScope('courses')
export class MyCoursesController {
  constructor(
    private readonly progress: ProgressService,
    private readonly access: LearnerAccessService,
  ) {}

  /** The learner's own courses, with where they are in each. */
  @RequirePermission('courses:read')
  @Get('courses')
  async mine(@CurrentUser() user: AuthUser) {
    const studentId = await this.access.requireOwnStudentId(user);
    return this.progress.coursesFor(studentId);
  }
}

@ApiTags('courses')
@Controller('sessions')
@ModuleScope('courses')
export class RecordingsController {
  constructor(private readonly recordings: RecordingsService) {}

  /** Publishes a class recording into a course, where learners find it as a lesson. */
  @RequirePermission('sessions:run')
  @Post(':id/recording')
  attach(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: recordingSchema }) body: z.infer<typeof recordingSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.recordings.attach(id, body, user);
  }
}
