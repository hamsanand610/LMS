import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  scheduleRangeSchema,
  seriesCreateSchema,
  sessionCreateSchema,
  sessionListQuerySchema,
  sessionStatusSchema,
  sessionUpdateSchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { SessionsService } from './sessions.service.js';
import { ReadsNotices } from '../notifications/index.js';

const idSchema = z.uuid();
const seriesCreateBodySchema = z.object({
  series: seriesCreateSchema,
  /** Set once the person has seen the clashes and decided to go ahead anyway. */
  allowConflicts: z.boolean().default(false),
});

@ApiTags('schedule')
@Controller('batches/:batchId')
@ModuleScope('sessions')
export class BatchScheduleController {
  constructor(private readonly sessions: SessionsService) {}

  @RequirePermission('sessions:read')
  @Get('series')
  listSeries(
    @Param('batchId', { schema: idSchema }) batchId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sessions.listSeries(batchId, user);
  }

  /** Shows what a timetable would create before anything is written. */
  @RequirePermission('sessions:manage')
  @Post('series/preview')
  preview(
    @Param('batchId', { schema: idSchema }) batchId: string,
    @Body({ schema: seriesCreateSchema }) body: z.infer<typeof seriesCreateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sessions.previewSeries(batchId, body, user);
  }

  @RequirePermission('sessions:manage')
  @Post('series')
  createSeries(
    @Param('batchId', { schema: idSchema }) batchId: string,
    @Body({ schema: seriesCreateBodySchema }) body: z.infer<typeof seriesCreateBodySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sessions.createSeries(batchId, body.series, user, {
      allowConflicts: body.allowConflicts,
    });
  }

  @RequirePermission('sessions:manage')
  @Post('sessions')
  createSession(
    @Param('batchId', { schema: idSchema }) batchId: string,
    @Body({ schema: sessionCreateSchema }) body: z.infer<typeof sessionCreateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sessions.createOne(batchId, body, user);
  }
}

@ApiTags('schedule')
@Controller('series')
@ModuleScope('sessions')
export class SeriesController {
  constructor(private readonly sessions: SessionsService) {}

  @RequirePermission('sessions:manage')
  @Delete(':id')
  end(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.sessions.endSeries(id, user);
  }
}

@ApiTags('schedule')
@Controller('sessions')
@ModuleScope('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @RequirePermission('sessions:read')
  @Get()
  list(
    @Query({ schema: sessionListQuerySchema }) query: z.infer<typeof sessionListQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sessions.list(query, user);
  }

  @RequirePermission('sessions:read')
  @Get(':id')
  get(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.sessions.get(id, user);
  }

  @RequirePermission('sessions:manage')
  @Patch(':id')
  update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: sessionUpdateSchema }) body: z.infer<typeof sessionUpdateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sessions.update(id, body, user);
  }

  /** Trainers run their own classes: starting, finishing and cancelling them. */
  @RequirePermission('sessions:run')
  @Post(':id/status')
  setStatus(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: sessionStatusSchema }) body: z.infer<typeof sessionStatusSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sessions.setStatus(id, body, user);
  }
}

@ApiTags('schedule')
@Controller('me')
@ModuleScope('sessions')
export class MyScheduleController {
  constructor(private readonly sessions: SessionsService) {}

  /** The caller's own timetable: their batches as a student, their classes as a trainer. */
  @RequirePermission('sessions:read')
  @ReadsNotices('/schedule')
  @Get('schedule')
  mine(
    @Query({ schema: scheduleRangeSchema }) query: z.infer<typeof scheduleRangeSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sessions.mySchedule(user, query);
  }
}
