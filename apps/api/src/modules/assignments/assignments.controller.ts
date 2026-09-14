import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  assignmentCreateSchema,
  assignmentListQuerySchema,
  assignmentPublishSchema,
  assignmentStructureSchema,
  assignmentUpdateSchema,
  gradeSchema,
  submissionSchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { AssignmentsService } from './assignments.service.js';
import { SubmissionsService } from './submissions.service.js';

const idSchema = z.uuid();
const batchQuerySchema = z.object({ batchId: z.uuid().optional() });
const queueQuerySchema = z.object({ assignmentId: z.uuid().optional() });

@ApiTags('assignments')
@Controller('assignments')
@ModuleScope('assignments')
export class AssignmentsController {
  constructor(
    private readonly assignments: AssignmentsService,
    private readonly submissions: SubmissionsService,
  ) {}

  @RequirePermission('assignments:manage')
  @Get()
  list(
    @Query({ schema: assignmentListQuerySchema }) query: z.infer<typeof assignmentListQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assignments.list(query, user);
  }

  @RequirePermission('assignments:manage')
  @Post()
  create(
    @Body({ schema: assignmentCreateSchema }) body: z.infer<typeof assignmentCreateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assignments.create(body, user);
  }

  /** The queue of written answers waiting for a person. */
  @RequirePermission('assignments:grade')
  @Get('grading/queue')
  queue(
    @Query({ schema: queueQuerySchema }) query: z.infer<typeof queueQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.submissions.queue(user, query);
  }

  @RequirePermission('assignments:manage')
  @Get(':id')
  get(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.assignments.get(id, user);
  }

  @RequirePermission('assignments:manage')
  @Patch(':id')
  update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: assignmentUpdateSchema }) body: z.infer<typeof assignmentUpdateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assignments.update(id, body, user);
  }

  @RequirePermission('assignments:manage')
  @Put(':id/structure')
  saveStructure(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: assignmentStructureSchema }) body: z.infer<typeof assignmentStructureSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assignments.saveStructure(id, body, user);
  }

  @RequirePermission('assignments:manage')
  @Delete(':id')
  archive(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.assignments.archive(id, user);
  }

  @RequirePermission('assignments:manage')
  @Get(':id/publications')
  publications(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.assignments.publications(id, user);
  }

  @RequirePermission('assignments:publish')
  @Post(':id/publish')
  publish(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: assignmentPublishSchema }) body: z.infer<typeof assignmentPublishSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assignments.publish(id, body, user);
  }

  @RequirePermission('assignments:publish')
  @Delete(':id/publications/:publicationId')
  withdraw(
    @Param('id', { schema: idSchema }) id: string,
    @Param('publicationId', { schema: idSchema }) publicationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assignments.withdraw(id, publicationId, user);
  }

  @RequirePermission('assignments:manage')
  @Get(':id/progress')
  progress(
    @Param('id', { schema: idSchema }) id: string,
    @Query({ schema: batchQuerySchema }) query: z.infer<typeof batchQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assignments.progress(id, query, user);
  }

  // ───────────────────────── the learner's side ─────────────────────────

  @RequirePermission('assignments:read')
  @Get(':id/me')
  mineDetail(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.submissions.detailForLearner(id, user);
  }

  @RequirePermission('assignments:read')
  @Get(':id/questions/:placementId')
  question(
    @Param('id', { schema: idSchema }) id: string,
    @Param('placementId', { schema: idSchema }) placementId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.submissions.questionForLearner(id, placementId, user);
  }

  /** The cases a coding answer is marked against; see the note on the service method. */
  @RequirePermission('assignments:read')
  @Get(':id/questions/:placementId/cases')
  cases(
    @Param('id', { schema: idSchema }) id: string,
    @Param('placementId', { schema: idSchema }) placementId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.submissions.gradingCases(id, placementId, user);
  }

  @RequirePermission('assignments:submit')
  @Post(':id/questions/:placementId/submissions')
  submit(
    @Param('id', { schema: idSchema }) id: string,
    @Param('placementId', { schema: idSchema }) placementId: string,
    @Body({ schema: submissionSchema }) body: z.infer<typeof submissionSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.submissions.submit(id, placementId, body, user);
  }
}

@ApiTags('assignments')
@Controller('submissions')
@ModuleScope('assignments')
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @RequirePermission('assignments:grade')
  @Post(':id/grade')
  grade(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: gradeSchema }) body: z.infer<typeof gradeSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.submissions.grade(id, body, user);
  }
}

@ApiTags('assignments')
@Controller('me')
@ModuleScope('assignments')
export class MyAssignmentsController {
  constructor(private readonly submissions: SubmissionsService) {}

  /** The learner's own assignments, with how far they have got in each. */
  @RequirePermission('assignments:read')
  @Get('assignments')
  mine(@CurrentUser() user: AuthUser) {
    return this.submissions.mine(user);
  }
}
