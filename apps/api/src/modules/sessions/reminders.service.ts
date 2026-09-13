import { Injectable, Logger } from '@nestjs/common';
import { toLocalDateKey } from '@lms/shared';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { JobsService } from '../../core/queue/jobs.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { NotificationsService } from '../notifications/index.js';

export const SESSION_REMINDER_JOB = 'sessions.reminders';

/** How far ahead a class is announced. Long enough to get ready, short enough to be about today. */
const REMINDER_WINDOW_MINUTES = 30;

/**
 * Tells a batch its class is about to start. `reminderSentAt` is stamped as the reminder goes out,
 * so a restart, a second worker or a re-run never sends the same reminder twice.
 */
@Injectable()
export class SessionRemindersService {
  private readonly logger = new Logger(SessionRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly notifications: NotificationsService,
    private readonly jobs: JobsService,
  ) {
    this.jobs.register(
      SESSION_REMINDER_JOB,
      async () => {
        await this.sendDue();
      },
      { cron: '*/5 * * * *' },
    );
  }

  /** Sends the reminders now due. Returns how many classes were announced. */
  async sendDue(now = new Date()): Promise<number> {
    const until = new Date(now.getTime() + REMINDER_WINDOW_MINUTES * 60_000);
    const due = await this.prisma.liveSession.findMany({
      where: {
        status: 'scheduled',
        reminderSentAt: null,
        startsAt: { gt: now, lte: until },
      },
      include: { batch: { select: { code: true } } },
      take: 100,
    });
    if (due.length === 0) return 0;

    const org = await this.tenant.getOrganization();
    let sent = 0;
    for (const session of due) {
      // Stamp first: a reminder that fails to send is better than one sent twice.
      const claimed = await this.prisma.liveSession.updateMany({
        where: { id: session.id, reminderSentAt: null },
        data: { reminderSentAt: new Date() },
      });
      if (claimed.count === 0) continue;

      const members = await this.prisma.batchMember.findMany({
        where: { batchId: session.batchId, isActive: true },
        select: { student: { select: { userId: true } } },
      });
      const userIds = members.map((m) => m.student.userId);
      if (session.trainerId) {
        const trainer = await this.prisma.trainerProfile.findUnique({
          where: { id: session.trainerId },
          select: { userId: true },
        });
        if (trainer) userIds.push(trainer.userId);
      }
      if (userIds.length === 0) continue;

      const time = new Intl.DateTimeFormat('en-GB', {
        timeZone: org.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(session.startsAt);
      await this.notifications.deliver({
        category: 'batch',
        type: 'session.reminder',
        title: `${session.subject} starts at ${time}`,
        body: `${session.batch.code} on ${toLocalDateKey(session.startsAt, org.timezone)}.`,
        link: '/schedule',
        channels: ['in_app'],
        userIds: [...new Set(userIds)],
      });
      sent += 1;
    }
    if (sent > 0) this.logger.log(`Reminded ${sent} classes starting soon`);
    return sent;
  }
}
