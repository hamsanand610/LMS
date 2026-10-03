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
  analyticsQuerySchema,
  assignmentCreateSchema,
  assignmentListQuerySchema,
  assignmentPublishSchema,
  assignmentResourcesSchema,
  assignmentStructureSchema,
  assignmentUpdateSchema,
  learnerAssignmentQuerySchema,
  reviewInputSchema,
  reviewListQuerySchema,
  runInputSchema,
  submissionInputSchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { RateLimit } from '../../core/rate-limit/rate-limit.decorator.js';
import { AssignmentsService } from './assignments.service.js';
import { AssignmentInsightsService } from './insights.service.js';
import { LearnerAssignmentsService } from './learner-assignments.service.js';
import { SubmissionsService } from './submissions.service.js';
import { ReadsNotices } from '../notifications/index.js';

const idSchema = z.uuid();
const progressQuerySchema = z.object({ batchId: z.uuid().optional() });

/** Writing assignments, giving them out, and following how they go. */
@ApiTags('assignments')
@Controller('assignments')
@ModuleScope('assignments')
export class AssignmentsController {
  constructor(
    private readonly assignments: AssignmentsService,
    private readonly insights: AssignmentInsightsService,
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

  /** Totals, completion, scores, submission volume and the hardest questions, in the caller's scope. */
  @RequirePermission('assignments:manage')
  @Get('analytics')
  analytics(
    @Query({ schema: analyticsQuerySchema }) query: z.infer<typeof analyticsQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.insights.analytics(query, user);
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
  @Put(':id/resources')
  saveResources(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: assignmentResourcesSchema }) body: z.infer<typeof assignmentResourcesSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assignments.saveResources(id, body, user);
  }

  @RequirePermission('assignments:manage')
  @Get(':id/resources/:resourceId/link')
  resourceLink(
    @Param('id', { schema: idSchema }) id: string,
    @Param('resourceId', { schema: idSchema }) resourceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assignments.resourceLink(id, resourceId, user);
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

  /** One row per learner the assignment reaches in the caller's batches. */
  @RequirePermission('assignments:manage')
  @Get(':id/progress')
  progress(
    @Param('id', { schema: idSchema }) id: string,
    @Query({ schema: progressQuerySchema }) query: z.infer<typeof progressQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.insights.progress(id, query, user);
  }
}

/** Answers, as the people who review them see them. */
@ApiTags('assignments')
@Controller('submissions')
@ModuleScope('assignments')
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  /** What is waiting for a decision (or has one), in the reviewer's batches. */
  @RequirePermission('assignments:grade')
  @Get()
  queue(
    @Query({ schema: reviewListQuerySchema }) query: z.infer<typeof reviewListQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.submissions.reviewQueue(user, query);
  }

  @RequirePermission('assignments:grade')
  @Get(':id')
  get(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.submissions.staffView(user, id);
  }

  /** A decision is added to the submission's reviews; nothing already recorded is changed. */
  @RequirePermission('assignments:grade')
  @Post(':id/reviews')
  review(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: reviewInputSchema }) body: z.infer<typeof reviewInputSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.submissions.review(user, id, body);
  }

  @RequirePermission('assignments:grade')
  @Post(':id/re-evaluate')
  reEvaluate(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.submissions.reEvaluate(user, id);
  }

  @RequirePermission('assignments:grade')
  @Get(':id/files/:fileId/link')
  fileLink(
    @Param('id', { schema: idSchema }) id: string,
    @Param('fileId', { schema: idSchema }) fileId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.submissions.fileLink(user, id, fileId);
  }
}

/** The learner's own assignments and answers. */
@ApiTags('assignments')
@Controller('me')
@ModuleScope('assignments')
export class MyAssignmentsController {
  constructor(
    private readonly learner: LearnerAssignmentsService,
    private readonly submissions: SubmissionsService,
  ) {}

  @RequirePermission('assignments:read')
  @Get('assignments')
  list(
    @Query({ schema: learnerAssignmentQuerySchema })
    query: z.infer<typeof learnerAssignmentQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.learner.list(user, query);
  }

  @RequirePermission('assignments:read')
  @ReadsNotices('/assignments/:id')
  @Get('assignments/:id')
  detail(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.learner.detail(user, id);
  }

  @RequirePermission('assignments:read')
  @Get('assignments/:id/resources/:resourceId/link')
  resourceLink(
    @Param('id', { schema: idSchema }) id: string,
    @Param('resourceId', { schema: idSchema }) resourceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.learner.resourceLink(user, id, resourceId);
  }

  @RequirePermission('assignments:read')
  @ReadsNotices('/assignments/:id/q/:placementId')
  @Get('assignments/:id/questions/:placementId')
  workspace(
    @Param('id', { schema: idSchema }) id: string,
    @Param('placementId', { schema: idSchema }) placementId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.learner.workspace(user, id, placementId);
  }

  @RequirePermission('assignments:read')
  @Get('assignments/:id/questions/:placementId/submissions')
  history(
    @Param('id', { schema: idSchema }) id: string,
    @Param('placementId', { schema: idSchema }) placementId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.learner.history(user, id, placementId);
  }

  /** Runs the answer on the visible cases or the learner's own input. Nothing is recorded. */
  @RequirePermission('assignments:submit')
  @RateLimit({ points: 40, durationSec: 300, keyBy: 'user' })
  @Post('assignments/:id/questions/:placementId/run')
  @HttpCode(200)
  run(
    @Param('id', { schema: idSchema }) id: string,
    @Param('placementId', { schema: idSchema }) placementId: string,
    @Body({ schema: runInputSchema }) body: z.infer<typeof runInputSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.submissions.run(user, id, placementId, body);
  }

  @RequirePermission('assignments:submit')
  @RateLimit({ points: 30, durationSec: 300, keyBy: 'user' })
  @Post('assignments/:id/questions/:placementId/submissions')
  submit(
    @Param('id', { schema: idSchema }) id: string,
    @Param('placementId', { schema: idSchema }) placementId: string,
    @Body({ schema: submissionInputSchema }) body: z.infer<typeof submissionInputSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.submissions.submit(user, id, placementId, body);
  }

  @RequirePermission('assignments:read')
  @Get('submissions/:id')
  submission(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.submissions.mine(user, id);
  }

  @RequirePermission('assignments:read')
  @Get('submissions/:id/files/:fileId/link')
  fileLink(
    @Param('id', { schema: idSchema }) id: string,
    @Param('fileId', { schema: idSchema }) fileId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.submissions.fileLink(user, id, fileId);
  }
}
