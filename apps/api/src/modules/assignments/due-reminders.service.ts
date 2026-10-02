import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { formatDateTime } from '@lms/shared';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { JobsService } from '../../core/queue/jobs.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { NotificationsService } from '../notifications/index.js';
import { learnersReached } from './reach.js';

const DUE_SOON_JOB = 'assignments.due_soon';
const DAY_MS = 86_400_000;

/**
 * "Due soon" (Phase 2, LRN-16): once per publication, a day before its due date, the learners it
 * reaches who have not yet handed in every question are reminded. Learners who have finished hear
 * nothing; a publication withdrawn or without a due date is left alone.
 */
@Injectable()
export class DueRemindersService implements OnModuleInit {
  private readonly logger = new Logger(DueRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly tenant: TenantService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(
      DUE_SOON_JOB,
      async () => {
        await this.remind();
      },
      { cron: '15 * * * *' },
    );
  }

  async remind(now = new Date()): Promise<number> {
    const due = await this.prisma.assignmentPublication.findMany({
      where: {
        withdrawnAt: null,
        dueAt: { gt: now, lte: new Date(now.getTime() + DAY_MS) },
        assignment: { status: 'published', deletedAt: null },
      },
      include: { assignment: { select: { id: true, title: true } } },
    });
    if (due.length === 0) return 0;
    const timezone = (await this.tenant.getOrganization()).timezone;
    let sent = 0;

    for (const publication of due) {
      if (
        await this.notifications.alreadySent('assignment.due_soon', 'publicationId', publication.id)
      ) {
        continue;
      }
      const studentIds = [...(await learnersReached(this.prisma, [publication])).keys()];
      if (studentIds.length === 0) continue;

      // Who has handed in every question: their answers (not sandbox failures) cover each one.
      const questionCount = await this.prisma.assignmentQuestion.count({
        where: { module: { assignmentId: publication.assignmentId } },
      });
      const handedIn = await this.prisma.submission.findMany({
        where: {
          assignmentId: publication.assignmentId,
          studentId: { in: studentIds },
          status: { not: 'error' },
        },
        distinct: ['studentId', 'assignmentQuestionId'],
        select: { studentId: true },
      });
      const answered = new Map<string, number>();
      for (const row of handedIn)
        answered.set(row.studentId, (answered.get(row.studentId) ?? 0) + 1);
      const outstanding = studentIds.filter((id) => (answered.get(id) ?? 0) < questionCount);
      if (outstanding.length === 0) continue;

      const users = await this.prisma.studentProfile.findMany({
        where: { id: { in: outstanding } },
        select: { userId: true },
      });
      await this.notifications.deliver({
        category: 'assessment',
        type: 'assignment.due_soon',
        title: `Due soon: ${publication.assignment.title}`,
        body: `Due by ${formatDateTime(publication.dueAt!, { timeZone: timezone })}. Hand in what you have before then.`,
        link: `/assignments/${publication.assignment.id}`,
        data: { publicationId: publication.id },
        channels: ['in_app'],
        userIds: users.map((u) => u.userId),
      });
      sent += 1;
    }
    if (sent > 0) this.logger.log(`Reminded learners about ${sent} assignment(s) due soon`);
    return sent;
  }
}
