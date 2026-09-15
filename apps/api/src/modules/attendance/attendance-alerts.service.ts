import { Injectable, Logger } from '@nestjs/common';
import { toLocalDateKey } from '@lms/shared';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { JobsService } from '../../core/queue/jobs.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { NotificationsService } from '../notifications/index.js';
import { AttendanceService } from './attendance.service.js';

export const ATTENDANCE_NUDGE_JOB = 'attendance.nudge_unmarked';
export const ATTENDANCE_ALERT_JOB = 'attendance.low_attendance';

/** How long after a class ends before its trainer is reminded to mark it (master F-13 §11). */
const NUDGE_AFTER_MINUTES = 60;

/** Where the "this week's alert has gone out" watermark lives, so a re-run sends nothing twice. */
const ALERT_WATERMARK_KEY = 'attendance.low_alert_week';

/**
 * The two jobs attendance owns. Both are safe to re-run: the nudge stamps the session as it goes
 * out, and the weekly alert records the week it covered before sending (rule 39).
 */
@Injectable()
export class AttendanceAlertsService {
  private readonly logger = new Logger(AttendanceAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly notifications: NotificationsService,
    private readonly attendance: AttendanceService,
    private readonly jobs: JobsService,
  ) {
    this.jobs.register(
      ATTENDANCE_NUDGE_JOB,
      async () => {
        await this.nudgeUnmarked();
      },
      { cron: '*/15 * * * *' },
    );
    // Monday morning, before the week's first class.
    this.jobs.register(
      ATTENDANCE_ALERT_JOB,
      async () => {
        await this.alertLowAttendance();
      },
      { cron: '0 7 * * 1' },
    );
  }

  /** Reminds a trainer about a class that finished an hour ago and has not been marked. */
  async nudgeUnmarked(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - NUDGE_AFTER_MINUTES * 60_000);
    const due = await this.prisma.liveSession.findMany({
      where: {
        status: 'completed',
        attendanceMarkedAt: null,
        attendanceReminderSentAt: null,
        endsAt: { lte: cutoff },
        trainerId: { not: null },
      },
      include: {
        batch: { select: { code: true } },
        trainer: { select: { userId: true } },
      },
      take: 100,
    });
    if (due.length === 0) return 0;

    const org = await this.tenant.getOrganization();
    let sent = 0;
    for (const session of due) {
      // Stamp first: a nudge that fails to send is better than one sent twice.
      const claimed = await this.prisma.liveSession.updateMany({
        where: { id: session.id, attendanceReminderSentAt: null },
        data: { attendanceReminderSentAt: new Date() },
      });
      if (claimed.count === 0 || !session.trainer) continue;

      await this.notifications.deliver({
        category: 'attendance',
        type: 'attendance.unmarked',
        title: `Attendance not marked for ${session.subject}`,
        body: `${session.batch.code} on ${toLocalDateKey(session.startsAt, org.timezone)} is waiting for its roll call.`,
        link: `/trainer/sessions/${session.id}/attendance`,
        channels: ['in_app'],
        userIds: [session.trainer.userId],
      });
      sent += 1;
    }
    if (sent > 0) this.logger.log(`Nudged ${sent} unmarked classes`);
    return sent;
  }

  /**
   * Tells students who have fallen below the threshold, once a week. The watermark is the ISO
   * week the run covered, so running the job twice in one week sends nothing the second time.
   */
  async alertLowAttendance(now = new Date()): Promise<number> {
    const org = await this.tenant.getOrganization();
    const week = isoWeekKey(now);
    const watermark = await this.prisma.setting.findUnique({
      where: { organizationId_key: { organizationId: org.id, key: ALERT_WATERMARK_KEY } },
    });
    if (watermark && (watermark.value as { week?: string } | null)?.week === week) {
      return 0;
    }

    const rows = await this.attendance.lowAttendanceFor({ limit: 500 });
    await this.prisma.setting.upsert({
      where: { organizationId_key: { organizationId: org.id, key: ALERT_WATERMARK_KEY } },
      create: { organizationId: org.id, key: ALERT_WATERMARK_KEY, value: { week } },
      update: { value: { week } },
    });
    if (rows.length === 0) return 0;

    const students = await this.prisma.studentProfile.findMany({
      where: { id: { in: rows.map((r) => r.studentId) } },
      select: { id: true, userId: true },
    });
    const userIdByStudent = new Map(students.map((s) => [s.id, s.userId]));

    let sent = 0;
    for (const row of rows) {
      const userId = userIdByStudent.get(row.studentId);
      if (!userId) continue;
      await this.notifications.deliver({
        category: 'attendance',
        type: 'attendance.below_threshold',
        title: `Your attendance is ${row.percentage}%`,
        body: `You have attended ${row.attended} of ${row.conducted} classes in ${row.batchCode}. Speak to your trainer if something is in the way.`,
        link: '/progress',
        channels: ['in_app'],
        userIds: [userId],
      });
      sent += 1;
    }
    this.logger.log(`Flagged ${sent} students below the attendance threshold for week ${week}`);
    return sent;
  }
}

/** ISO week key, e.g. `2026-W38`. Weeks start on Monday, as the job's schedule does. */
function isoWeekKey(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Thursday of this week decides the year the week belongs to (ISO 8601).
  const day = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
