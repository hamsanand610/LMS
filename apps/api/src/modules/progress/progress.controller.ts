import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { paginationQuerySchema } from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import {
  AuthenticatedOnly,
  CurrentUser,
  ModuleScope,
  RequirePermission,
} from '../../core/auth/decorators.js';
import { StudentDashboardService } from './dashboard.service.js';
import { LearnerAccessService } from './learner-access.service.js';
import { ProgressService } from './progress.service.js';

const idSchema = z.uuid();

@ApiTags('progress')
@Controller('me')
@ModuleScope('progress')
export class MeProgressController {
  constructor(
    private readonly progress: ProgressService,
    private readonly dashboard: StudentDashboardService,
    private readonly access: LearnerAccessService,
  ) {}

  /** The learner's own progress. Staff use `/students/:id/progress` for somebody else's. */
  @RequirePermission('progress:read')
  @Get('progress')
  async mine(@CurrentUser() user: AuthUser) {
    const studentId = await this.access.requireOwnStudentId(user);
    return this.progress.overview(studentId, user.id);
  }

  /** The student home page aggregate. */
  @AuthenticatedOnly()
  @Get('dashboard')
  dashboardForMe(@CurrentUser() user: AuthUser) {
    return this.dashboard.build(user);
  }

  @AuthenticatedOnly()
  @Get('activity')
  activity(
    @Query({ schema: paginationQuerySchema }) query: z.infer<typeof paginationQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.progress.activity(user.id, query.pageSize);
  }
}

@ApiTags('progress')
@Controller('students')
@ModuleScope('progress')
export class StudentProgressController {
  constructor(
    private readonly progress: ProgressService,
    private readonly access: LearnerAccessService,
  ) {}

  /** A staff view of one learner. Batch-scoped staff only reach their own batches' students. */
  @RequirePermission('progress:read')
  @Get(':id/progress')
  async forStudent(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    const student = await this.access.requireVisibleStudent(id, user);
    return this.progress.overview(student.id, student.userId);
  }
}
