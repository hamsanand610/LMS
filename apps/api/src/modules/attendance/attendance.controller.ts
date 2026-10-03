import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  attendanceMarkSchema,
  attendanceRangeQuerySchema,
  attendanceSessionsQuerySchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { ForbiddenError } from '../../core/http/errors.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { AttendanceService } from './attendance.service.js';
import { ReadsNotices } from '../notifications/index.js';

const idSchema = z.uuid();

const alertsQuerySchema = z.object({
  batchId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

@ApiTags('attendance')
@Controller('sessions/:sessionId/attendance')
@ModuleScope('attendance')
export class SessionAttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  /** The roll call: everybody on the roster, and whatever has already been marked. */
  @RequirePermission('attendance:read')
  @ReadsNotices('/sessions/:sessionId/attendance', { anyPortal: true })
  @Get()
  forSession(
    @Param('sessionId', { schema: idSchema }) sessionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attendance.forSession(sessionId, user);
  }

  /** Takes or corrects the roll call. Replaces the marks sent; the rest are left alone. */
  @RequirePermission('attendance:mark')
  @Put()
  mark(
    @Param('sessionId', { schema: idSchema }) sessionId: string,
    @Body({ schema: attendanceMarkSchema }) body: z.infer<typeof attendanceMarkSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attendance.mark(sessionId, body, user);
  }
}

@ApiTags('attendance')
@Controller('attendance')
@ModuleScope('attendance')
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly scope: ScopeService,
  ) {}

  /** Classes with their marking state: the admin attendance page and the batch tab. */
  @RequirePermission('attendance:read')
  @Get('sessions')
  listSessions(
    @Query({ schema: attendanceSessionsQuerySchema })
    query: z.infer<typeof attendanceSessionsQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attendance.listSessions(query, user);
  }

  /** Students below the institute's threshold, most urgent first. */
  @RequirePermission('attendance:read')
  @Get('alerts')
  alerts(
    @Query({ schema: alertsQuerySchema }) query: z.infer<typeof alertsQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attendance.lowAttendance(user, { batchId: query.batchId, limit: query.limit });
  }

  /** One student's record, for the staff views. A learner uses `/me/attendance`. */
  @RequirePermission('attendance:read')
  @Get('students/:studentId')
  forStudent(
    @Param('studentId', { schema: idSchema }) studentId: string,
    @Query({ schema: attendanceRangeQuerySchema })
    query: z.infer<typeof attendanceRangeQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attendance.forStudent(studentId, query, user);
  }
}

@ApiTags('attendance')
@Controller('me')
@ModuleScope('attendance')
export class MeAttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly scope: ScopeService,
  ) {}

  /** The learner's own attendance: the percentage, the subjects and the calendar. */
  @RequirePermission('attendance:read')
  @Get('attendance')
  async mine(
    @Query({ schema: attendanceRangeQuerySchema })
    query: z.infer<typeof attendanceRangeQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    const person = await this.scope.personFor(user.id);
    if (!person.studentId) {
      throw new ForbiddenError('Only a student has attendance of their own.');
    }
    return this.attendance.forStudent(person.studentId, query, user, { asSelf: true });
  }
}
