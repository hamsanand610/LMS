import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  formatDateTime,
  toLocalDateKey,
  type AttendanceAlertRow,
  type AttendanceDay,
  type AttendanceDayEntry,
  type AttendanceMarkInput,
  type AttendanceMarkResult,
  type AttendanceSessionRow,
  type AttendanceSessionsQuery,
  type AttendanceStatus,
  type AttendanceSummary,
  type Paginated,
  type SessionAttendanceStudent,
  type SessionAttendanceView,
  type StudentAttendanceView,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { type AuthUser, hasPermission, scopeFor } from '../../core/auth/auth-user.js';
import { DomainRuleError, ForbiddenError, NotFoundError } from '../../core/http/errors.js';
import { paginate, skipTake } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ScopeService, narrowToBatch } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { SettingsService } from '../settings/index.js';
import { attendancePercentage, summarise } from './attendance-math.js';

/** A class can only be marked once it has happened. */
const MARKABLE_SESSION_STATUSES = new Set(['live', 'completed']);

interface AttendanceRules {
  countedStatuses: AttendanceStatus[];
  thresholdPct: number;
  correctionWindowHours: number;
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly scope: ScopeService,
    private readonly settings: SettingsService,
  ) {}

  /** The institute's attendance rules, read once per request that needs them. */
  async rules(): Promise<AttendanceRules> {
    const academic = await this.settings.getSection('academic');
    return {
      countedStatuses: academic.attendanceCountedStatuses,
      thresholdPct: academic.attendanceThresholdPct,
      correctionWindowHours: academic.attendanceCorrectionWindowHours,
    };
  }

  // ───────────────────────── one class ─────────────────────────

  /** The roll call for one class: everybody on the roster, with whatever is already marked. */
  async forSession(sessionId: string, user: AuthUser): Promise<SessionAttendanceView> {
    const session = await this.requireSession(sessionId, user, 'attendance:read');
    const rules = await this.rules();

    const [members, records] = await Promise.all([
      this.prisma.batchMember.findMany({
        where: { batchId: session.batchId, isActive: true },
        include: {
          student: { include: { user: { select: { name: true, email: true } } } },
        },
        orderBy: { student: { studentCode: 'asc' } },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { sessionId },
        include: {
          markedBy: { select: { name: true } },
          correctedBy: { select: { name: true } },
        },
      }),
    ]);

    const byStudent = new Map(records.map((r) => [r.studentId, r]));
    const history = await this.percentagesForBatch(
      session.batchId,
      members.map((m) => m.studentId),
      rules,
      sessionId,
    );

    const students: SessionAttendanceStudent[] = members.map((member) => {
      const record = byStudent.get(member.studentId);
      return {
        studentId: member.studentId,
        studentCode: member.student.studentCode,
        name: member.student.user.name,
        email: member.student.user.email,
        status: record?.status ?? null,
        note: record?.note ?? '',
        markedAt: record?.markedAt.toISOString() ?? null,
        markedByName: record?.markedBy?.name ?? null,
        correctedAt: record?.correctedAt?.toISOString() ?? null,
        correctedByName: record?.correctedBy?.name ?? null,
        correctionReason: record?.correctionReason ?? '',
        attendancePct: history.get(member.studentId) ?? null,
      };
    });

    const marked = session.attendanceMarkedAt;
    const windowEndsAt = marked
      ? new Date(marked.getTime() + rules.correctionWindowHours * 3_600_000)
      : null;
    const withinWindow = windowEndsAt === null || windowEndsAt.getTime() > Date.now();
    const blocked = this.markingBlockedReason(session, user, withinWindow);

    return {
      session: {
        id: session.id,
        batchId: session.batchId,
        batchCode: session.batch.code,
        batchName: session.batch.name,
        subject: session.subject,
        title: session.title,
        startsAt: session.startsAt.toISOString(),
        endsAt: session.endsAt.toISOString(),
        status: session.status,
        trainerName: session.trainer?.user.name ?? null,
      },
      canMark: blocked === null,
      blockedReason: blocked,
      markedAt: marked?.toISOString() ?? null,
      markedByName: session.attendanceMarkedBy?.name ?? null,
      correctionWindowEndsAt: windowEndsAt?.toISOString() ?? null,
      withinCorrectionWindow: withinWindow,
      rules: {
        defaultStatus: 'present',
        countedStatuses: rules.countedStatuses,
        thresholdPct: rules.thresholdPct,
        correctionWindowHours: rules.correctionWindowHours,
      },
      students,
    };
  }

  /**
   * Takes or corrects the roll call. A first marking needs `attendance:mark`; changing a mark
   * after the correction window has closed needs `attendance:manage` as well, and every change
   * to an existing mark needs a reason (plan AC-05.2).
   */
  async mark(
    sessionId: string,
    input: AttendanceMarkInput,
    user: AuthUser,
  ): Promise<AttendanceMarkResult> {
    const session = await this.requireSession(sessionId, user, 'attendance:mark');
    const rules = await this.rules();

    if (!MARKABLE_SESSION_STATUSES.has(session.status)) {
      throw new DomainRuleError(
        'A class can be marked once it has started. Set it live or completed first.',
        'session_not_started',
      );
    }

    const existing = await this.prisma.attendanceRecord.findMany({ where: { sessionId } });
    const existingByStudent = new Map(existing.map((r) => [r.studentId, r]));

    const marked = session.attendanceMarkedAt;
    const windowEndsAt = marked
      ? new Date(marked.getTime() + rules.correctionWindowHours * 3_600_000)
      : null;
    const withinWindow = windowEndsAt === null || windowEndsAt.getTime() > Date.now();
    if (!withinWindow && !hasPermission(user, 'attendance:manage')) {
      throw new ForbiddenError(
        `Attendance for this class can no longer be corrected here; it closed on ${windowEndsAt ? formatDateTime(windowEndsAt, { timeZone: (await this.tenant.getOrganization()).timezone }) : 'an earlier date'}. Ask an administrator.`,
        'correction_window_closed',
      );
    }

    const members = await this.prisma.batchMember.findMany({
      where: { batchId: session.batchId, isActive: true },
      select: { studentId: true },
    });
    const roster = new Set(members.map((m) => m.studentId));
    const strangers = input.records.filter((r) => !roster.has(r.studentId));
    if (strangers.length > 0) {
      throw new DomainRuleError(
        `${strangers.length} of the students sent are not in this batch.`,
        'not_in_batch',
      );
    }

    const corrections = input.records.filter((record) => {
      const previous = existingByStudent.get(record.studentId);
      return previous !== undefined && previous.status !== record.status;
    });
    if (corrections.length > 0 && input.reason.trim().length === 0) {
      throw new DomainRuleError(
        'Say why the attendance is being changed. The reason is kept with the record.',
        'reason_required',
      );
    }

    const now = new Date();
    const actorId = user.id;
    let markedCount = 0;
    let correctedCount = 0;
    let unchanged = 0;

    for (const record of input.records) {
      const previous = existingByStudent.get(record.studentId);
      if (previous && previous.status === record.status && previous.note === record.note) {
        unchanged += 1;
        continue;
      }
      if (previous) {
        await this.prisma.attendanceRecord.update({
          where: { id: previous.id },
          data: {
            status: record.status,
            note: record.note,
            correctedById: actorId,
            correctedAt: now,
            correctionReason: input.reason,
          },
        });
        correctedCount += 1;
        await this.audit.record({
          action: 'attendance.corrected',
          resourceType: 'attendance_record',
          resourceId: previous.id,
          summary: `${session.batch.code} · ${session.subject}: ${previous.status} → ${record.status}`,
          before: { status: previous.status, note: previous.note },
          after: { status: record.status, note: record.note, reason: input.reason },
        });
      } else {
        await this.prisma.attendanceRecord.create({
          data: {
            sessionId,
            studentId: record.studentId,
            batchId: session.batchId,
            status: record.status,
            note: record.note,
            markedById: actorId,
            markedAt: now,
          },
        });
        markedCount += 1;
      }
    }

    await this.prisma.liveSession.update({
      where: { id: sessionId },
      data: {
        attendanceMarkedAt: marked ?? now,
        attendanceMarkedById: marked ? session.attendanceMarkedById : actorId,
      },
    });

    if (markedCount > 0) {
      await this.audit.record({
        action: 'attendance.marked',
        resourceType: 'live_session',
        resourceId: sessionId,
        summary: `${session.batch.code} · ${session.subject}: ${markedCount} marked`,
        after: { marked: markedCount, corrected: correctedCount },
      });
    }

    this.events.emit('attendance.marked', {
      sessionId,
      batchId: session.batchId,
      marked: markedCount,
      corrected: correctedCount,
    });

    return {
      marked: markedCount,
      corrected: correctedCount,
      unchanged,
      markedAt: (marked ?? now).toISOString(),
    };
  }

  // ───────────────────────── a student's own record ─────────────────────────

  /** One student's attendance over a range: the summary, the subjects and a day-by-day list. */
  async forStudent(
    studentId: string,
    query: { from?: string; to?: string; subject?: string; batchId?: string },
    user: AuthUser,
    options: { asSelf: boolean } = { asSelf: false },
  ): Promise<StudentAttendanceView> {
    const org = await this.tenant.getOrganization();
    const student = await this.prisma.studentProfile.findFirst({
      where: { id: studentId, user: { organizationId: org.id, deletedAt: null } },
      include: {
        user: { select: { name: true } },
        members: { where: { isActive: true }, select: { batchId: true } },
      },
    });
    if (!student) throw new NotFoundError('Student');

    if (!options.asSelf) {
      this.requireStaffScope(user, 'attendance:read');
      const visible = await this.scope.visibleBatchIds(user, 'attendance:read');
      if (visible !== null) {
        const shared = student.members.some((m) => visible.includes(m.batchId));
        if (!shared) throw new ForbiddenError('This student is not in one of your batches.');
      }
    }

    const rules = await this.rules();
    const to = query.to ? endOfDay(query.to) : new Date();
    const from = query.from ? startOfDay(query.from) : addDays(to, -90);
    const batchIds = student.members.map((m) => m.batchId);
    const scopedBatchIds =
      query.batchId && batchIds.includes(query.batchId) ? [query.batchId] : batchIds;

    const sessions = await this.prisma.liveSession.findMany({
      where: {
        batchId: {
          in: scopedBatchIds.length > 0 ? scopedBatchIds : ['00000000-0000-0000-0000-000000000000'],
        },
        startsAt: { gte: from, lte: to },
        ...(query.subject ? { subject: query.subject } : {}),
      },
      include: { attendance: { where: { studentId } } },
      orderBy: { startsAt: 'asc' },
    });

    const now = new Date();
    const days = new Map<string, AttendanceDayEntry[]>();
    const counts: Partial<Record<AttendanceStatus, number>> = {};
    const bySubject = new Map<string, { conducted: number; attended: number }>();

    for (const session of sessions) {
      const record = session.attendance[0] ?? null;
      const dateKey = toLocalDateKey(session.startsAt, org.timezone);
      const entry: AttendanceDayEntry = {
        sessionId: session.id,
        subject: session.subject,
        title: session.title || session.subject,
        startsAt: session.startsAt.toISOString(),
        endsAt: session.endsAt.toISOString(),
        status: record?.status ?? null,
        note: record?.note ?? '',
        upcoming: session.startsAt > now && session.status === 'scheduled',
        cancelled: session.status === 'cancelled',
      };
      const list = days.get(dateKey);
      if (list) list.push(entry);
      else days.set(dateKey, [entry]);

      if (!record) continue;
      counts[record.status] = (counts[record.status] ?? 0) + 1;
      const subject = bySubject.get(session.subject) ?? { conducted: 0, attended: 0 };
      subject.conducted += 1;
      if (rules.countedStatuses.includes(record.status)) subject.attended += 1;
      bySubject.set(session.subject, subject);
    }

    const summary: AttendanceSummary = summarise({
      counts,
      countedStatuses: rules.countedStatuses,
      thresholdPct: rules.thresholdPct,
    });

    const dayList: AttendanceDay[] = [...days.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, entries]) => ({ date, entries }));

    return {
      studentId,
      studentName: student.user.name,
      range: {
        from: toLocalDateKey(from, org.timezone),
        to: toLocalDateKey(to, org.timezone),
      },
      summary,
      bySubject: [...bySubject.entries()]
        .map(([subject, figures]) => ({
          subject,
          conducted: figures.conducted,
          attended: figures.attended,
          percentage: attendancePercentage(figures.attended, figures.conducted),
        }))
        .sort((a, b) => a.subject.localeCompare(b.subject)),
      days: dayList,
    };
  }

  // ───────────────────────── the sessions list ─────────────────────────

  /** Classes with their marking state, for the admin attendance page and the batch tab. */
  async listSessions(
    query: AttendanceSessionsQuery,
    user: AuthUser,
  ): Promise<Paginated<AttendanceSessionRow>> {
    this.requireStaffScope(user, 'attendance:read');
    const org = await this.tenant.getOrganization();
    const batches = narrowToBatch(
      await this.scope.visibleBatchIds(user, 'attendance:read'),
      query.batchId,
    );

    const where = {
      batch: {
        organizationId: org.id,
        deletedAt: null,
        ...(batches === null ? {} : { id: { in: batches } }),
      },
      ...(query.trainerId ? { trainerId: query.trainerId } : {}),
      ...(query.from || query.to
        ? {
            startsAt: {
              ...(query.from ? { gte: startOfDay(query.from) } : {}),
              ...(query.to ? { lte: endOfDay(query.to) } : {}),
            },
          }
        : {}),
      ...(query.state === 'marked' ? { attendanceMarkedAt: { not: null } } : {}),
      ...(query.state === 'unmarked'
        ? { attendanceMarkedAt: null, status: { in: ['live' as const, 'completed' as const] } }
        : {}),
      ...(query.q ? { subject: { contains: query.q, mode: 'insensitive' as const } } : {}),
    };

    const [total, sessions] = await this.prisma.$transaction([
      this.prisma.liveSession.count({ where }),
      this.prisma.liveSession.findMany({
        where,
        include: {
          batch: { select: { id: true, code: true, name: true } },
          trainer: { include: { user: { select: { name: true } } } },
          attendanceMarkedBy: { select: { name: true } },
          attendance: { select: { status: true } },
          _count: { select: { attendance: true } },
        },
        orderBy: { startsAt: 'desc' },
        ...skipTake(query),
      }),
    ]);

    const rules = await this.rules();
    const rosterSizes = await this.rosterSizes([...new Set(sessions.map((s) => s.batchId))]);

    const rows: AttendanceSessionRow[] = sessions.map((session) => {
      const attended = session.attendance.filter((r) =>
        rules.countedStatuses.includes(r.status),
      ).length;
      const markedCount = session._count.attendance;
      return {
        sessionId: session.id,
        batchId: session.batchId,
        batchCode: session.batch.code,
        batchName: session.batch.name,
        subject: session.subject,
        title: session.title || session.subject,
        startsAt: session.startsAt.toISOString(),
        endsAt: session.endsAt.toISOString(),
        sessionStatus: session.status,
        trainerName: session.trainer?.user.name ?? null,
        rosterSize: rosterSizes.get(session.batchId) ?? 0,
        markedCount,
        presentCount: attended,
        percentage: attendancePercentage(attended, markedCount),
        isMarked: session.attendanceMarkedAt !== null,
        markedAt: session.attendanceMarkedAt?.toISOString() ?? null,
        markedByName: session.attendanceMarkedBy?.name ?? null,
      };
    });

    return paginate(rows, total, query);
  }

  /** Students below the institute's threshold, most urgent first. */
  async lowAttendance(
    user: AuthUser,
    options: { batchId?: string; limit?: number } = {},
  ): Promise<AttendanceAlertRow[]> {
    this.requireStaffScope(user, 'attendance:read');
    const visible = await this.scope.visibleBatchIds(user, 'attendance:read');
    return this.lowAttendanceFor({
      batchIds: narrowToBatch(visible, options.batchId) ?? undefined,
      limit: options.limit ?? 10,
    });
  }

  /** The same list without a caller, for the jobs that nudge and alert. */
  async lowAttendanceFor(options: {
    batchIds?: string[];
    limit?: number;
  }): Promise<AttendanceAlertRow[]> {
    const rules = await this.rules();
    const records = await this.prisma.attendanceRecord.findMany({
      where: options.batchIds ? { batchId: { in: options.batchIds } } : {},
      select: {
        studentId: true,
        batchId: true,
        status: true,
        student: {
          select: { studentCode: true, user: { select: { name: true } } },
        },
        batch: { select: { code: true } },
      },
    });

    const tally = new Map<
      string,
      {
        studentId: string;
        batchId: string;
        studentCode: string;
        name: string;
        batchCode: string;
        conducted: number;
        attended: number;
      }
    >();
    for (const record of records) {
      const key = `${record.studentId}:${record.batchId}`;
      const entry = tally.get(key) ?? {
        studentId: record.studentId,
        batchId: record.batchId,
        studentCode: record.student.studentCode,
        name: record.student.user.name,
        batchCode: record.batch.code,
        conducted: 0,
        attended: 0,
      };
      entry.conducted += 1;
      if (rules.countedStatuses.includes(record.status)) entry.attended += 1;
      tally.set(key, entry);
    }

    return [...tally.values()]
      .map((entry) => ({
        ...entry,
        percentage: attendancePercentage(entry.attended, entry.conducted) ?? 100,
      }))
      .filter((entry) => entry.conducted > 0 && entry.percentage < rules.thresholdPct)
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, options.limit ?? 10);
  }

  /** How many classes have happened but nobody has marked. */
  async unmarkedCount(user: AuthUser): Promise<number> {
    const visible = await this.scope.visibleBatchIds(user, 'attendance:read');
    return this.prisma.liveSession.count({
      where: {
        status: 'completed',
        attendanceMarkedAt: null,
        ...(visible === null ? {} : { batchId: { in: visible } }),
      },
    });
  }

  /**
   * Each student's attendance over every batch they have been marked in, by the institute's rule.
   * Null for a student with no marked class yet. Placement eligibility reads this.
   */
  async overallPercentages(studentIds: string[]): Promise<Map<string, number | null>> {
    if (studentIds.length === 0) return new Map();
    const rules = await this.rules();
    const grouped = await this.prisma.attendanceRecord.groupBy({
      by: ['studentId', 'status'],
      where: { studentId: { in: studentIds } },
      _count: { _all: true },
    });
    const tally = new Map<string, { conducted: number; attended: number }>();
    for (const row of grouped) {
      const entry = tally.get(row.studentId) ?? { conducted: 0, attended: 0 };
      entry.conducted += row._count._all;
      if (rules.countedStatuses.includes(row.status)) entry.attended += row._count._all;
      tally.set(row.studentId, entry);
    }
    return new Map(
      studentIds.map((id) => {
        const entry = tally.get(id);
        return [id, entry ? attendancePercentage(entry.attended, entry.conducted) : null];
      }),
    );
  }

  // ───────────────────────── helpers ─────────────────────────

  /** Percentage per student in a batch, optionally ignoring one class (the one being marked). */
  private async percentagesForBatch(
    batchId: string,
    studentIds: string[],
    rules: AttendanceRules,
    excludeSessionId?: string,
  ): Promise<Map<string, number | null>> {
    if (studentIds.length === 0) return new Map();
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        batchId,
        studentId: { in: studentIds },
        ...(excludeSessionId ? { sessionId: { not: excludeSessionId } } : {}),
      },
      select: { studentId: true, status: true },
    });
    const tally = new Map<string, { conducted: number; attended: number }>();
    for (const record of records) {
      const entry = tally.get(record.studentId) ?? { conducted: 0, attended: 0 };
      entry.conducted += 1;
      if (rules.countedStatuses.includes(record.status)) entry.attended += 1;
      tally.set(record.studentId, entry);
    }
    return new Map(
      studentIds.map((id) => {
        const entry = tally.get(id);
        return [id, entry ? attendancePercentage(entry.attended, entry.conducted) : null];
      }),
    );
  }

  private async rosterSizes(batchIds: string[]): Promise<Map<string, number>> {
    if (batchIds.length === 0) return new Map();
    const grouped = await this.prisma.batchMember.groupBy({
      by: ['batchId'],
      where: { batchId: { in: batchIds }, isActive: true },
      _count: { _all: true },
    });
    return new Map(grouped.map((row) => [row.batchId, row._count._all]));
  }

  private markingBlockedReason(
    session: { status: string; attendanceMarkedAt: Date | null },
    user: AuthUser,
    withinWindow: boolean,
  ): string | null {
    if (!hasPermission(user, 'attendance:mark') && !hasPermission(user, 'attendance:manage')) {
      return 'You can see this roll call but not change it.';
    }
    if (!MARKABLE_SESSION_STATUSES.has(session.status)) {
      return session.status === 'cancelled'
        ? 'This class was cancelled, so there is nobody to mark.'
        : 'This class has not started yet. It can be marked once it is live or finished.';
    }
    if (!withinWindow && !hasPermission(user, 'attendance:manage')) {
      return 'The correction window has closed. An administrator can still change it.';
    }
    return null;
  }

  /**
   * A learner holds `attendance:read` at scope `own`, which is their own record and nothing else.
   * The roll call, the sessions list and another person's record are staff views, so a caller
   * whose widest scope is `own` is refused here rather than shown the rest of the class.
   */
  private requireStaffScope(user: AuthUser, permission: string): void {
    const scope = scopeFor(user, permission);
    if (scope === null || scope === 'own') {
      throw new ForbiddenError(
        'You can see your own attendance at /me/attendance, but not anybody else’s.',
      );
    }
  }

  private async requireSession(sessionId: string, user: AuthUser, permission: string) {
    this.requireStaffScope(user, permission);
    const org = await this.tenant.getOrganization();
    const session = await this.prisma.liveSession.findFirst({
      where: { id: sessionId, batch: { organizationId: org.id, deletedAt: null } },
      include: {
        batch: { select: { id: true, code: true, name: true } },
        trainer: { include: { user: { select: { name: true } } } },
        attendanceMarkedBy: { select: { name: true } },
      },
    });
    if (!session) throw new NotFoundError('Session');

    const visible = await this.scope.visibleBatchIds(user, permission);
    if (visible !== null && !visible.includes(session.batchId)) {
      throw new ForbiddenError('This class belongs to a batch you are not assigned to.');
    }
    return session;
  }
}

function startOfDay(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function endOfDay(dateKey: string): Date {
  return new Date(`${dateKey}T23:59:59.999Z`);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
