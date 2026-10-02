import { Injectable } from '@nestjs/common';
import {
  addDaysToDateKey,
  toLocalDateKey,
  zonedDateTimeToUtc,
  type StudentDashboard,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ModuleStateService } from '../../core/registry/module-state.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { AnnouncementsService, NotificationsService } from '../notifications/index.js';
import { learnerSessionItem, SESSION_INCLUDE } from '../sessions/session-item.js';
import { AssessmentProgressService } from './assessment-progress.service.js';
import { ProgressService } from './progress.service.js';

/**
 * The student home page in one request: today's classes, what to carry on with, how far they have
 * got, and what has been announced. The tiles that later phases will fill are named in `pending`
 * rather than shown as zeroes, so the page never states a figure it cannot measure (plan DP-A01).
 */
@Injectable()
export class StudentDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
    private readonly scope: ScopeService,
    private readonly announcements: AnnouncementsService,
    private readonly notifications: NotificationsService,
    private readonly assessment: AssessmentProgressService,
    private readonly tenant: TenantService,
    private readonly modules: ModuleStateService,
  ) {}

  async build(user: AuthUser): Promise<StudentDashboard> {
    const person = await this.scope.personFor(user.id);
    const studentId = person.studentId;
    const now = new Date();
    // Today and tomorrow in the institute's own time zone, not a window around the clock; a class
    // that has already finished leaves the list, so the next ones are what the learner sees.
    const zone = (await this.tenant.getOrganization()).timezone;
    const today = toLocalDateKey(now, zone);
    const dayStart = zonedDateTimeToUtc(today, '00:00', zone);
    const dayEnd = zonedDateTimeToUtc(addDaysToDateKey(today, 2), '00:00', zone);

    const [sessions, announcements, inbox, batches] = await Promise.all([
      person.batchIds.length === 0
        ? Promise.resolve([])
        : this.prisma.liveSession.findMany({
            where: {
              batchId: { in: person.batchIds },
              startsAt: { gte: dayStart, lt: dayEnd },
              endsAt: { gte: now },
              status: { not: 'cancelled' },
            },
            orderBy: { startsAt: 'asc' },
            take: 10,
            include: SESSION_INCLUDE,
          }),
      this.announcements.activeFor(user),
      this.notifications.summary(user),
      person.batchIds.length === 0
        ? Promise.resolve([])
        : this.prisma.batch.findMany({
            where: { id: { in: person.batchIds }, deletedAt: null },
            orderBy: { startDate: 'desc' },
            select: { id: true, code: true, name: true, status: true },
          }),
    ]);

    const overview = studentId
      ? await this.progress.overview(studentId, user.id)
      : { overall: EMPTY_OVERALL, courses: [], activity: [], attendance: null, pending: [] };
    const tasks = studentId ? await this.assessment.tasksFor(studentId, person.batchIds) : [];
    const certificates =
      studentId && (await this.modules.isEnabled('certificates'))
        ? await this.prisma.certificate.count({ where: { studentId, status: 'issued' } })
        : null;

    return {
      today: sessions.map((row) => learnerSessionItem(row, now)),
      continueLearning: overview.courses.filter((c) => c.status !== 'completed').slice(0, 4),
      progress: overview.overall,
      tasks,
      announcements: announcements.slice(0, 4).map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        startsAt: a.startsAt,
      })),
      attendance: overview.attendance,
      assessment: 'assessment' in overview ? overview.assessment : null,
      unreadNotifications: inbox.unread,
      notifications: inbox.latest.slice(0, 4),
      activity: overview.activity.slice(0, 6),
      certificates,
      batches,
      pending: overview.pending,
    };
  }
}

const EMPTY_OVERALL = {
  courses: 0,
  completedCourses: 0,
  lessons: 0,
  completedLessons: 0,
  progressPct: 0,
  minutesWatched: 0,
};
