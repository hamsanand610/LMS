import { Injectable } from '@nestjs/common';
import type { StudentDashboard } from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { AnnouncementsService, NotificationsService } from '../notifications/index.js';
import { SESSION_INCLUDE, toSessionItem } from '../sessions/session-item.js';
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
  ) {}

  async build(user: AuthUser): Promise<StudentDashboard> {
    const person = await this.scope.personFor(user.id);
    const studentId = person.studentId;
    const now = new Date();
    const dayStart = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const dayEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const [sessions, announcements, unread, batches] = await Promise.all([
      person.batchIds.length === 0
        ? Promise.resolve([])
        : this.prisma.liveSession.findMany({
            where: {
              batchId: { in: person.batchIds },
              startsAt: { gte: dayStart, lte: dayEnd },
              status: { not: 'cancelled' },
            },
            orderBy: { startsAt: 'asc' },
            take: 10,
            include: SESSION_INCLUDE,
          }),
      this.announcements.activeFor(user),
      this.notifications.unreadCount(user.id),
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
      : { overall: EMPTY_OVERALL, courses: [], activity: [], pending: [] };
    const tasks = studentId ? await this.assessment.tasksFor(studentId, person.batchIds) : [];

    return {
      today: sessions.map((row) => toSessionItem(row, now)),
      continueLearning: overview.courses.filter((c) => c.status !== 'completed').slice(0, 4),
      progress: overview.overall,
      tasks,
      announcements: announcements.slice(0, 4).map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        startsAt: a.startsAt,
      })),
      unreadNotifications: unread,
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
