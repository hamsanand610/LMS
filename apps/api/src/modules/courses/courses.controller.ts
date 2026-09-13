import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  courseCreateSchema,
  courseListQuerySchema,
  courseUpdateSchema,
  lessonProgressSchema,
  outlineSchema,
  publishSchema,
  recordingSchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { LearnerAccessService, ProgressService } from '../progress/index.js';
import { CoursesService } from './courses.service.js';
import { LessonsService } from './lessons.service.js';
import { RecordingsService } from './recordings.service.js';

const idSchema = z.uuid();

@ApiTags('courses')
@Controller('courses')
@ModuleScope('courses')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

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

  @RequirePermission('courses:manage')
  @Patch(':id')
  update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: courseUpdateSchema }) body: z.infer<typeof courseUpdateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.courses.update(id, body, user);
  }

  /** The whole outline in one save, so ordering and nesting stay consistent. */
  @RequirePermission('courses:manage')
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

  @RequirePermission('courses:read')
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
  constructor(private readonly lessons: LessonsService) {}

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

  @RequirePermission('progress:read')
  @Post(':id/progress')
  recordProgress(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: lessonProgressSchema }) body: z.infer<typeof lessonProgressSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lessons.recordProgress(id, body, user);
  }

  @RequirePermission('progress:read')
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
