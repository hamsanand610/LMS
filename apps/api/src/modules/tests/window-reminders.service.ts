import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { formatDateTime } from '@lms/shared';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { JobsService } from '../../core/queue/jobs.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { NotificationsService } from '../notifications/index.js';

const CLOSING_SOON_JOB = 'tests.closing_soon';
const DAY_MS = 86_400_000;

/**
 * "Closing soon" (Phase 2, LRN-16): once per window, a day before it closes, the learners of its
 * batch who have not sat the test are reminded. A learner who has handed in a paper hears nothing.
 */
@Injectable()
export class WindowRemindersService implements OnModuleInit {
  private readonly logger = new Logger(WindowRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly tenant: TenantService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(
      CLOSING_SOON_JOB,
      async () => {
        await this.remind();
      },
      { cron: '20 * * * *' },
    );
  }

  async remind(now = new Date()): Promise<number> {
    const closing = await this.prisma.testSchedule.findMany({
      where: {
        opensAt: { lte: now },
        closesAt: { gt: now, lte: new Date(now.getTime() + DAY_MS) },
        test: { status: 'published', deletedAt: null },
      },
      include: { test: { select: { id: true, title: true } } },
    });
    if (closing.length === 0) return 0;
    const timezone = (await this.tenant.getOrganization()).timezone;
    let sent = 0;

    for (const schedule of closing) {
      if (await this.notifications.alreadySent('test.closing_soon', 'scheduleId', schedule.id)) {
        continue;
      }
      const members = await this.prisma.batchMember.findMany({
        where: { batchId: schedule.batchId, isActive: true },
        select: { studentId: true, student: { select: { userId: true } } },
      });
      const sat = new Set(
        (
          await this.prisma.testAttempt.findMany({
            where: { scheduleId: schedule.id, status: { not: 'in_progress' } },
            select: { studentId: true },
          })
        ).map((a) => a.studentId),
      );
      const userIds = members.filter((m) => !sat.has(m.studentId)).map((m) => m.student.userId);
      if (userIds.length === 0) continue;

      await this.notifications.deliver({
        category: 'assessment',
        type: 'test.closing_soon',
        title: `${schedule.test.title} closes soon`,
        body: `The window closes on ${formatDateTime(schedule.closesAt, { timeZone: timezone })}. Sit it before then.`,
        link: `/tests/${schedule.test.id}`,
        data: { scheduleId: schedule.id },
        channels: ['in_app'],
        userIds,
      });
      sent += 1;
    }
    if (sent > 0) this.logger.log(`Reminded learners about ${sent} test window(s) closing soon`);
    return sent;
  }
}
