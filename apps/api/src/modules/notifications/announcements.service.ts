import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type AnnouncementCreateInput,
  type AnnouncementItem,
  type AnnouncementStatus,
  type Audience,
  type Paginated,
  audienceSchema,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import type { AuthUser } from '../../core/auth/auth-user.js';
import {
  DomainRuleError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../core/http/errors.js';
import { paginate, skipTake } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { JobsService } from '../../core/queue/jobs.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { requireOpenAudience } from '../../core/scope/open-audience.js';
import { NotificationsService } from './notifications.service.js';

export const ANNOUNCEMENT_DISPATCH_JOB = 'announcements.dispatch';

/**
 * Announcements are broadcasts with a validity window. A scheduled announcement is delivered by
 * the dispatch job once its start time passes, so a client can prepare messages in advance.
 * Delivery happens exactly once; `deliveredAt` is the guard.
 *
 * A trainer (`announcements:manage` at batch scope) announces to the batches they teach and
 * manages only what they wrote (Phases 3–4, D7). Their audience names batches only: a role in an
 * audience reaches that role across the institute.
 */
@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly notifications: NotificationsService,
    private readonly jobs: JobsService,
    private readonly scope: ScopeService,
  ) {
    this.jobs.register(
      ANNOUNCEMENT_DISPATCH_JOB,
      async () => {
        await this.dispatchDue();
      },
      { cron: '*/5 * * * *' },
    );
  }

  async list(
    query: {
      page: number;
      pageSize: number;
      q?: string;
      status?: AnnouncementStatus;
    },
    user: AuthUser,
  ): Promise<Paginated<AnnouncementItem>> {
    const org = await this.tenant.getOrganization();
    const reach = await this.scope.visibleBatchIds(user, 'announcements:manage');
    const where = {
      organizationId: org.id,
      deletedAt: null,
      // A trainer's list is what they wrote.
      ...(reach === null ? {} : { createdById: user.id }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' as const } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        orderBy: { startsAt: 'desc' },
        ...skipTake(query),
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return paginate(await this.withAuthors(rows), total, query);
  }

  /** Announcements a signed-in person should see right now (active and addressed to them). */
  async activeFor(user: AuthUser): Promise<AnnouncementItem[]> {
    const org = await this.tenant.getOrganization();
    const now = new Date();
    const rows = await this.prisma.announcement.findMany({
      where: {
        organizationId: org.id,
        deletedAt: null,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: { startsAt: 'desc' },
      take: 20,
    });
    const visible: typeof rows = [];
    for (const row of rows) {
      const audience = audienceSchema.parse(row.audience ?? {});
      const recipients = await this.notifications.resolveAudience(audience);
      if (recipients.includes(user.id)) visible.push(row);
    }
    return this.withAuthors(visible.slice(0, 5));
  }

  async create(input: AnnouncementCreateInput, actor: AuthUser): Promise<AnnouncementItem> {
    const org = await this.tenant.getOrganization();
    await this.requireAudienceInReach(input.audience, actor);
    await requireOpenAudience(this.prisma, input.audience);
    const startsAt = new Date(input.startsAt);
    const row = await this.prisma.announcement.create({
      data: {
        organizationId: org.id,
        title: input.title,
        body: input.body,
        audience: input.audience,
        channels: input.channels,
        startsAt,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        status: startsAt <= new Date() ? 'active' : 'scheduled',
        createdById: actor.id,
      },
    });
    await this.audit.record({
      action: 'announcements.created',
      resourceType: 'announcement',
      resourceId: row.id,
      after: { title: input.title, startsAt: input.startsAt, channels: input.channels },
      summary: `Announcement "${input.title}" created`,
    });
    if (row.status === 'active') await this.dispatch(row.id);
    return this.get(row.id);
  }

  async update(
    id: string,
    patch: Partial<AnnouncementCreateInput>,
    actor: AuthUser,
  ): Promise<AnnouncementItem> {
    const org = await this.tenant.getOrganization();
    const before = await this.prisma.announcement.findFirst({
      where: { id, organizationId: org.id, deletedAt: null },
    });
    if (!before) throw new NotFoundError('Announcement');
    await this.requireOwn(before, actor);
    if (patch.audience) {
      await this.requireAudienceInReach(patch.audience, actor);
      await requireOpenAudience(this.prisma, patch.audience);
    }
    const startsAt = patch.startsAt ? new Date(patch.startsAt) : before.startsAt;
    // Delivered once, at its start; moving the start afterwards would promise a second delivery.
    if (before.deliveredAt && startsAt.getTime() !== before.startsAt.getTime()) {
      throw new DomainRuleError(
        'This announcement has gone out, so its start cannot move; write a new one',
        'announcement_delivered',
      );
    }
    await this.prisma.announcement.update({
      where: { id },
      data: {
        title: patch.title,
        body: patch.body,
        audience: patch.audience as object | undefined,
        channels: patch.channels,
        startsAt,
        endsAt:
          patch.endsAt === undefined ? undefined : patch.endsAt ? new Date(patch.endsAt) : null,
        status: computeStatus(
          startsAt,
          patch.endsAt === undefined ? before.endsAt : patch.endsAt ? new Date(patch.endsAt) : null,
        ),
      },
    });
    await this.audit.record({
      action: 'announcements.updated',
      resourceType: 'announcement',
      resourceId: id,
      before: { title: before.title, startsAt: before.startsAt, status: before.status },
      after: patch,
      summary: `Announcement "${before.title}" updated`,
      actorId: actor.id,
    });
    return this.get(id);
  }

  async remove(id: string, actor: AuthUser): Promise<void> {
    const org = await this.tenant.getOrganization();
    const row = await this.prisma.announcement.findFirst({
      where: { id, organizationId: org.id, deletedAt: null },
    });
    if (!row) throw new NotFoundError('Announcement');
    await this.requireOwn(row, actor);
    await this.prisma.announcement.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({
      action: 'announcements.deleted',
      resourceType: 'announcement',
      resourceId: id,
      before: { title: row.title },
      summary: `Announcement "${row.title}" removed`,
      actorId: actor.id,
    });
  }

  async get(id: string): Promise<AnnouncementItem> {
    const org = await this.tenant.getOrganization();
    const row = await this.prisma.announcement.findFirst({
      where: { id, organizationId: org.id, deletedAt: null },
    });
    if (!row) throw new NotFoundError('Announcement');
    const [item] = await this.withAuthors([row]);
    return item!;
  }

  /** A batch-scoped writer names only batches they teach, at least one, and nothing wider. */
  private async requireAudienceInReach(audience: Audience, user: AuthUser): Promise<void> {
    const reach = await this.scope.visibleBatchIds(user, 'announcements:manage');
    if (reach === null) return;
    const issues: { path: string; message: string }[] = [];
    if (audience.batchIds.length === 0) {
      issues.push({ path: 'audience.batchIds', message: 'Choose at least one of your batches' });
    }
    if (audience.batchIds.some((id) => !reach.includes(id))) {
      issues.push({ path: 'audience.batchIds', message: 'Choose only batches you teach' });
    }
    if (audience.roleKeys.length > 0 || audience.programIds.length > 0) {
      issues.push({
        path: 'audience',
        message: 'Announce to your batches; roles and programmes reach beyond them',
      });
    }
    if (issues.length > 0) throw new ValidationError(issues);
  }

  /** A batch-scoped writer changes only the announcements they wrote. */
  private async requireOwn(row: { createdById: string | null }, user: AuthUser): Promise<void> {
    const reach = await this.scope.visibleBatchIds(user, 'announcements:manage');
    if (reach !== null && row.createdById !== user.id) {
      throw new ForbiddenError('This announcement was written by someone else');
    }
  }

  /** Items with the name of whoever wrote each. */
  private async withAuthors(rows: AnnouncementRow[]): Promise<AnnouncementItem[]> {
    const ids = [...new Set(rows.map((r) => r.createdById).filter((id): id is string => !!id))];
    const users = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    const names = new Map(users.map((u) => [u.id, u.name]));
    return rows.map((row) => toItem(row, names));
  }

  /** Delivers one announcement to its audience, at most once. */
  async dispatch(id: string): Promise<number> {
    const row = await this.prisma.announcement.findFirst({
      where: { id, deletedAt: null, deliveredAt: null },
    });
    if (!row) return 0;
    const audience = audienceSchema.parse(row.audience ?? {});
    const recipients = await this.notifications.resolveAudience(audience);
    const delivered = await this.notifications.deliverNow({
      category: 'announcement',
      type: 'announcement.published',
      title: row.title,
      body: row.body,
      link: '/notifications',
      data: { announcementId: row.id },
      channels: row.channels as ('in_app' | 'email')[],
      userIds: recipients,
    });
    await this.prisma.announcement.update({
      where: { id },
      data: { deliveredAt: new Date(), recipientCount: delivered, status: 'active' },
    });
    this.events.emit('announcement.published', { announcementId: id, recipients: delivered });
    this.logger.log({ announcementId: id, recipients: delivered }, 'Announcement delivered');
    return delivered;
  }

  /** Cron: publishes announcements whose window has opened and expires those that ended. */
  async dispatchDue(): Promise<{ published: number; expired: number }> {
    const now = new Date();
    const due = await this.prisma.announcement.findMany({
      where: { deletedAt: null, deliveredAt: null, startsAt: { lte: now } },
      select: { id: true },
      take: 50,
    });
    for (const row of due) await this.dispatch(row.id);
    const expired = await this.prisma.announcement.updateMany({
      where: { deletedAt: null, endsAt: { lt: now }, status: { not: 'expired' } },
      data: { status: 'expired' },
    });
    return { published: due.length, expired: expired.count };
  }
}

function computeStatus(startsAt: Date, endsAt: Date | null): AnnouncementStatus {
  const now = new Date();
  if (endsAt && endsAt < now) return 'expired';
  if (startsAt > now) return 'scheduled';
  return 'active';
}

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  audience: unknown;
  channels: string[];
  startsAt: Date;
  endsAt: Date | null;
  status: string;
  deliveredAt: Date | null;
  recipientCount: number;
  createdById: string | null;
  createdAt: Date;
}

function toItem(row: AnnouncementRow, names: Map<string, string>): AnnouncementItem {
  const authorName = row.createdById ? names.get(row.createdById) : undefined;
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience: audienceSchema.parse(row.audience ?? {}) as Audience,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    channels: row.channels as AnnouncementItem['channels'],
    status: row.status as AnnouncementStatus,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    recipientCount: row.recipientCount,
    author: row.createdById && authorName ? { id: row.createdById, name: authorName } : null,
    createdAt: row.createdAt.toISOString(),
  };
}
