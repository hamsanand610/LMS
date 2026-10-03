import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  addDaysToDateKey,
  formatDate,
  formatTime,
  zonedDateTimeToUtc,
  type Paginated,
  type SeriesCreateInput,
  type SeriesPreview,
  type SessionCreateInput,
  type SessionItem,
  type SessionSeriesSummary,
  type SessionStatus,
  type Weekday,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { type AuthUser, hasPermission, holdsAtLeast, scopeFor } from '../../core/auth/auth-user.js';
import { DomainRuleError, ForbiddenError, NotFoundError } from '../../core/http/errors.js';
import { paginate, skipTake } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ScopeService, narrowToBatch } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { requireOpenAudience } from '../../core/scope/open-audience.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { type DeliveryRequest, NotificationsService } from '../notifications/index.js';
import {
  type Occurrence,
  findConflicts,
  findInternalConflicts,
  generateOccurrences,
} from './recurrence.js';
import { learnerSessionItem, SESSION_INCLUDE, toSessionItem } from './session-item.js';

interface ListQuery {
  page: number;
  pageSize: number;
  batchId?: string;
  trainerId?: string;
  status?: SessionStatus;
  from?: string;
  to?: string;
}

/** Statuses a session may move to from where it is now. */
const STATUS_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  scheduled: ['live', 'completed', 'cancelled'],
  live: ['completed', 'cancelled'],
  completed: ['scheduled'],
  cancelled: ['scheduled'],
};

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly scope: ScopeService,
    private readonly notifications: NotificationsService,
  ) {}

  // ───────────────────────── series ─────────────────────────

  /** What a proposed timetable would create, and what it would clash with. Writes nothing. */
  async previewSeries(
    batchId: string,
    input: SeriesCreateInput,
    user: AuthUser,
  ): Promise<SeriesPreview> {
    await this.requireBatch(batchId, user, 'sessions:manage');
    const occurrences = await this.expand(input);
    const conflicts = [
      ...findInternalConflicts(occurrences),
      ...(await this.conflictsFor(occurrences, batchId, input.trainerId, null)),
    ];
    return {
      occurrences: occurrences.map((o) => ({
        startsAt: o.startsAt.toISOString(),
        endsAt: o.endsAt.toISOString(),
      })),
      conflicts,
    };
  }

  /** Creates the series and every class it implies. Clashes are reported, not silently accepted. */
  async createSeries(
    batchId: string,
    input: SeriesCreateInput,
    user: AuthUser,
    options: { allowConflicts?: boolean } = {},
  ): Promise<SessionSeriesSummary> {
    const batch = await this.requireBatch(batchId, user, 'sessions:manage');
    await requireOpenAudience(this.prisma, { batchIds: [batchId] });
    if (input.trainerId) await this.requireTrainer(input.trainerId);
    const occurrences = await this.expand(input);
    if (occurrences.length === 0) {
      throw new DomainRuleError('Those days and dates produce no classes at all', 'no_occurrences');
    }
    if (!options.allowConflicts) {
      const conflicts = [
        ...findInternalConflicts(occurrences),
        ...(await this.conflictsFor(occurrences, batchId, input.trainerId, null)),
      ];
      if (conflicts.length > 0) {
        throw new DomainRuleError(
          `${conflicts.length} of those classes clash with something already scheduled`,
          'session_conflict',
        );
      }
    }

    const series = await this.prisma.sessionSeries.create({
      data: {
        batchId,
        subject: input.subject,
        title: input.title,
        trainerId: input.trainerId,
        weekdays: [...input.weekdays],
        startsTime: input.startsTime,
        endsTime: input.endsTime,
        fromDate: new Date(`${input.fromDate}T00:00:00Z`),
        untilDate: new Date(`${input.untilDate}T00:00:00Z`),
        joinUrl: input.joinUrl,
        provider: input.provider,
        skipDates: [...input.skipDates],
        createdById: user.id,
        sessions: {
          create: occurrences.map((o) => ({
            batchId,
            trainerId: input.trainerId,
            subject: input.subject,
            title: input.title,
            startsAt: o.startsAt,
            endsAt: o.endsAt,
            joinUrl: input.joinUrl,
            provider: input.provider,
          })),
        },
      },
      include: {
        trainer: { select: { user: { select: { name: true } } } },
        _count: { select: { sessions: true } },
      },
    });

    await this.audit.record({
      action: 'session.series_created',
      resourceType: 'session_series',
      resourceId: series.id,
      summary: `${input.subject} for ${batch.code}: ${occurrences.length} classes`,
      after: { batchId, subject: input.subject, occurrences: occurrences.length },
    });
    this.events.emit('session.created', {
      seriesId: series.id,
      batchId,
      count: occurrences.length,
    });
    // One notice for the whole series, not one per class.
    const first = occurrences[0];
    if (first) {
      await this.notifyBatch(batchId, {
        category: 'batch',
        type: 'session.scheduled',
        title: `${input.subject}: ${occurrences.length} classes on your timetable`,
        body: `The first is on ${formatWhen(first.startsAt, await this.timezone())}.`,
        link: '/schedule',
        channels: ['in_app'],
      });
    }
    return toSeriesSummary(series);
  }

  async listSeries(batchId: string, user: AuthUser): Promise<SessionSeriesSummary[]> {
    await this.requireBatch(batchId, user, 'sessions:read');
    const learner = asLearner(user);
    const rows = await this.prisma.sessionSeries.findMany({
      where: { batchId },
      orderBy: { fromDate: 'desc' },
      include: {
        trainer: { select: { user: { select: { name: true } } } },
        _count: { select: { sessions: true } },
      },
    });
    // A series' link is every class's link: a learner gets it class by class, when each opens.
    return rows.map((row) => {
      const summary = toSeriesSummary(row);
      return learner ? { ...summary, joinUrl: '' } : summary;
    });
  }

  /** Ends a series: future classes are withdrawn, past ones stay as the record of what happened. */
  async endSeries(id: string, user: AuthUser): Promise<{ removed: number }> {
    const series = await this.prisma.sessionSeries.findUnique({ where: { id } });
    if (!series) throw new NotFoundError('Series');
    await this.requireBatch(series.batchId, user, 'sessions:manage');

    const now = new Date();
    const removed = await this.prisma.liveSession.deleteMany({
      where: { seriesId: id, startsAt: { gt: now }, status: 'scheduled' },
    });
    await this.prisma.sessionSeries.update({
      where: { id },
      data: { status: 'ended', untilDate: now },
    });
    await this.audit.record({
      action: 'session.series_ended',
      resourceType: 'session_series',
      resourceId: id,
      summary: `${series.subject}: ${removed.count} future classes withdrawn`,
    });
    return { removed: removed.count };
  }

  // ───────────────────────── single sessions ─────────────────────────

  async list(query: ListQuery, user: AuthUser): Promise<Paginated<SessionItem>> {
    const batches = narrowToBatch(
      await this.scope.visibleBatchIds(user, 'sessions:read'),
      query.batchId,
    );
    const where = {
      ...(batches === null ? {} : { batchId: { in: batches } }),
      ...(query.trainerId ? { trainerId: query.trainerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(await this.rangeFilter(query.from, query.to)),
    };
    const [rows, total] = await Promise.all([
      this.prisma.liveSession.findMany({
        where,
        orderBy: { startsAt: 'asc' },
        ...skipTake(query),
        include: SESSION_INCLUDE,
      }),
      this.prisma.liveSession.count({ where }),
    ]);
    const now = new Date();
    const item = asLearner(user) ? learnerSessionItem : toSessionItem;
    return paginate(
      rows.map((row) => item(row, now)),
      total,
      query,
    );
  }

  async get(id: string, user: AuthUser): Promise<SessionItem> {
    const session = await this.find(id);
    await this.requireBatch(session.batchId, user, 'sessions:read');
    return asLearner(user) ? learnerSessionItem(session) : toSessionItem(session);
  }

  async createOne(
    batchId: string,
    input: SessionCreateInput,
    user: AuthUser,
  ): Promise<SessionItem> {
    const batch = await this.requireBatch(batchId, user, 'sessions:manage');
    await requireOpenAudience(this.prisma, { batchIds: [batchId] });
    if (input.trainerId) await this.requireTrainer(input.trainerId);
    const created = await this.prisma.liveSession.create({
      data: {
        batchId,
        trainerId: input.trainerId,
        subject: input.subject,
        title: input.title,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        joinUrl: input.joinUrl,
        provider: input.provider,
        notes: input.notes,
      },
      include: SESSION_INCLUDE,
    });
    await this.audit.record({
      action: 'session.created',
      resourceType: 'live_session',
      resourceId: created.id,
      summary: `${input.subject} for ${batch.code}`,
      after: { batchId, startsAt: input.startsAt },
    });
    this.events.emit('session.created', { sessionId: created.id, batchId });
    await this.notifyBatch(batchId, {
      category: 'batch',
      type: 'session.scheduled',
      title: `New class: ${created.subject}`,
      body: `It is on ${formatWhen(created.startsAt, await this.timezone())}.`,
      link: '/schedule',
      channels: ['in_app'],
    });
    return toSessionItem(created);
  }

  async update(
    id: string,
    input: {
      title?: string;
      startsAt?: string;
      endsAt?: string;
      joinUrl?: string;
      trainerId?: string | null;
      notes?: string;
    },
    user: AuthUser,
  ): Promise<SessionItem> {
    const session = await this.find(id);
    await this.requireBatch(session.batchId, user, 'sessions:manage');
    const startsAt = input.startsAt ? new Date(input.startsAt) : session.startsAt;
    const endsAt = input.endsAt ? new Date(input.endsAt) : session.endsAt;
    if (endsAt <= startsAt) {
      throw new DomainRuleError('The class must end after it starts', 'invalid_time_range');
    }
    if (input.trainerId) await this.requireTrainer(input.trainerId);

    const moved = Boolean(input.startsAt) && startsAt.getTime() !== session.startsAt.getTime();
    const updated = await this.prisma.liveSession.update({
      where: { id },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.joinUrl === undefined ? {} : { joinUrl: input.joinUrl }),
        ...(input.notes === undefined ? {} : { notes: input.notes }),
        ...(input.trainerId === undefined ? {} : { trainerId: input.trainerId }),
        startsAt,
        endsAt,
        // A moved class deserves its reminder again.
        ...(moved ? { reminderSentAt: null } : {}),
      },
      include: SESSION_INCLUDE,
    });
    await this.audit.record({
      action: 'session.updated',
      resourceType: 'live_session',
      resourceId: id,
      summary: `${session.subject} updated`,
      before: { startsAt: session.startsAt, endsAt: session.endsAt, trainerId: session.trainerId },
      after: { startsAt, endsAt, trainerId: updated.trainerId },
    });
    if (moved) {
      await this.notifyBatch(updated.batchId, {
        category: 'batch',
        type: 'session.rescheduled',
        title: `${updated.subject} has moved`,
        body: `The class is now on ${formatWhen(updated.startsAt, await this.timezone())}.`,
        link: '/schedule',
        channels: ['in_app'],
      });
    }
    this.events.emit('session.updated', { sessionId: id, batchId: updated.batchId });
    return toSessionItem(updated);
  }

  /** Marking a class live, finished or cancelled. Trainers may do this for their own batches. */
  async setStatus(
    id: string,
    input: { status: SessionStatus; reason: string },
    user: AuthUser,
  ): Promise<SessionItem> {
    const session = await this.find(id);
    await this.requireBatch(session.batchId, user, 'sessions:run');
    const current = session.status as SessionStatus;
    if (current === input.status) return toSessionItem(session);
    if (!STATUS_TRANSITIONS[current].includes(input.status)) {
      throw new DomainRuleError(
        `A ${current} class cannot be marked ${input.status}`,
        'invalid_status_transition',
      );
    }
    const updated = await this.prisma.liveSession.update({
      where: { id },
      data: {
        status: input.status,
        ...(input.reason
          ? { notes: `${session.notes}\n${input.reason}`.trim().slice(0, 1000) }
          : {}),
      },
      include: SESSION_INCLUDE,
    });
    await this.audit.record({
      action: 'session.status_changed',
      resourceType: 'live_session',
      resourceId: id,
      summary: `${session.subject}: ${current} to ${input.status}`,
      before: { status: current },
      after: { status: input.status, reason: input.reason },
    });
    if (input.status === 'cancelled') {
      const when = formatWhen(session.startsAt, await this.timezone());
      await this.notifyBatch(session.batchId, {
        category: 'batch',
        type: 'session.cancelled',
        title: `${session.subject} is cancelled`,
        body: input.reason || `The class on ${when} will not take place.`,
        link: '/schedule',
        channels: ['in_app', 'email'],
      });
      this.events.emit('session.cancelled', { sessionId: id, batchId: session.batchId });
    }
    return toSessionItem(updated);
  }

  // ───────────────────────── personal schedule ─────────────────────────

  /** The caller's own classes: a student's batches, a trainer's assignments. */
  async mySchedule(user: AuthUser, range: { from?: string; to?: string }): Promise<SessionItem[]> {
    const person = await this.scope.personFor(user.id);
    // The classes one teaches count only while one still runs classes: an assignment outlives a
    // trainer role that was taken away, and must not keep its timetable and links open.
    const teaches = Boolean(person.trainerId) && holdsAtLeast(user, 'sessions:run', 'batch');
    const reach: Prisma.LiveSessionWhereInput[] = [];
    if (person.memberBatchIds.length > 0) reach.push({ batchId: { in: person.memberBatchIds } });
    if (teaches && person.taughtBatchIds.length > 0) {
      reach.push({ batchId: { in: person.taughtBatchIds }, trainerId: person.trainerId });
    }
    if (reach.length === 0) return [];
    const rows = await this.prisma.liveSession.findMany({
      where: { OR: reach, ...(await this.rangeFilter(range.from, range.to, true)) },
      orderBy: { startsAt: 'asc' },
      take: 400,
      include: SESSION_INCLUDE,
    });
    const now = new Date();
    // A learner's own timetable holds the join link back until the class can be joined.
    const learner = Boolean(person.studentId) && !teaches;
    return rows.map((row) => (learner ? learnerSessionItem(row, now) : toSessionItem(row, now)));
  }

  // ───────────────────────── helpers ─────────────────────────

  private async expand(input: SeriesCreateInput): Promise<Occurrence[]> {
    return generateOccurrences(input, await this.timezone());
  }

  private async timezone(): Promise<string> {
    const org = await this.tenant.getOrganization();
    return org.timezone;
  }

  /** Overlaps with what the batch or the trainer already has, ignoring one series being edited. */
  private async conflictsFor(
    occurrences: Occurrence[],
    batchId: string,
    trainerId: string | null,
    ignoreSeriesId: string | null,
  ) {
    if (occurrences.length === 0) return [];
    const first = occurrences[0] as Occurrence;
    const last = occurrences[occurrences.length - 1] as Occurrence;
    const existing = await this.prisma.liveSession.findMany({
      where: {
        status: { not: 'cancelled' },
        startsAt: { gte: first.startsAt, lte: last.endsAt },
        ...(ignoreSeriesId ? { NOT: { seriesId: ignoreSeriesId } } : {}),
        OR: [{ batchId }, ...(trainerId ? [{ trainerId }] : [])],
      },
      select: { id: true, startsAt: true, endsAt: true, subject: true, batchId: true },
    });
    return findConflicts(
      occurrences,
      existing.map((row) => ({
        id: row.id,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        label:
          row.batchId === batchId
            ? `The batch already has ${row.subject} at that time`
            : `The trainer already has ${row.subject} at that time`,
      })),
    );
  }

  /** A range of the institute's calendar days, from the first day's midnight to the last's end. */
  private async rangeFilter(from?: string, to?: string, defaultWindow = false) {
    if (!from && !to && !defaultWindow) return {};
    const zone = await this.timezone();
    const start = from
      ? zonedDateTimeToUtc(from, '00:00', zone)
      : new Date(Date.now() - 7 * 86_400_000);
    const end = to
      ? zonedDateTimeToUtc(addDaysToDateKey(to, 1), '00:00', zone)
      : new Date(Date.now() + 30 * 86_400_000);
    return { startsAt: { gte: start, lt: end } };
  }

  private async find(id: string) {
    const session = await this.prisma.liveSession.findUnique({
      where: { id },
      include: SESSION_INCLUDE,
    });
    if (!session) throw new NotFoundError('Session');
    return session;
  }

  /** The batch, once it is established the caller may act on it with that permission. */
  private async requireBatch(batchId: string, user: AuthUser, permission: string) {
    const org = await this.tenant.getOrganization();
    const batch = await this.prisma.batch.findFirst({
      where: { id: batchId, organizationId: org.id, deletedAt: null },
      select: { id: true, code: true, name: true },
    });
    if (!batch) throw new NotFoundError('Batch');
    if (!hasPermission(user, permission)) {
      throw new ForbiddenError('You do not have access to this resource');
    }
    const visible = await this.scope.visibleBatchIds(user, permission);
    if (visible !== null && !visible.includes(batchId)) {
      throw new ForbiddenError('That batch is not one of yours');
    }
    return batch;
  }

  private async requireTrainer(trainerId: string) {
    const trainer = await this.prisma.trainerProfile.findFirst({
      where: { id: trainerId, user: { deletedAt: null } },
      select: { id: true },
    });
    if (!trainer) throw new NotFoundError('Trainer');
  }

  private async notifyBatch(
    batchId: string,
    message: Omit<DeliveryRequest, 'userIds' | 'audience'>,
  ): Promise<void> {
    const members = await this.prisma.batchMember.findMany({
      where: { batchId, isActive: true },
      select: { student: { select: { userId: true } } },
    });
    const userIds = members.map((m) => m.student.userId);
    if (userIds.length === 0) {
      this.logger.debug(`No active members in batch ${batchId}; nothing to notify`);
      return;
    }
    await this.notifications.deliver({ ...message, userIds });
  }
}

function toSeriesSummary(row: {
  id: string;
  batchId: string;
  subject: string;
  trainerId: string | null;
  weekdays: string[];
  startsTime: string;
  endsTime: string;
  fromDate: Date;
  untilDate: Date;
  provider: string;
  joinUrl: string;
  skipDates: string[];
  status: string;
  trainer?: { user?: { name: string } | null } | null;
  _count: { sessions: number };
}): SessionSeriesSummary {
  return {
    id: row.id,
    batchId: row.batchId,
    subject: row.subject,
    trainerId: row.trainerId,
    trainerName: row.trainer?.user?.name ?? null,
    weekdays: row.weekdays as Weekday[],
    startsTime: row.startsTime,
    endsTime: row.endsTime,
    fromDate: row.fromDate.toISOString().slice(0, 10),
    untilDate: row.untilDate.toISOString().slice(0, 10),
    provider: row.provider as SessionSeriesSummary['provider'],
    joinUrl: row.joinUrl,
    skipDates: row.skipDates,
    sessionCount: row._count.sessions,
    active: row.status === 'active',
  };
}

/**
 * Reads classes only as a learner does (`sessions:read` at `own`): such a caller is given a join
 * link only once the class can be joined, on whichever route they read the class through.
 */
function asLearner(user: AuthUser): boolean {
  return scopeFor(user, 'sessions:read') === 'own';
}

function formatWhen(date: Date, timeZone: string): string {
  return `${formatDate(date, { timeZone })} at ${formatTime(date, { timeZone })}`;
}
