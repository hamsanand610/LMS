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
import { NotFoundError } from '../../core/http/errors.js';
import { paginate, skipTake } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { JobsService } from '../../core/queue/jobs.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { NotificationsService } from './notifications.service.js';

export const ANNOUNCEMENT_DISPATCH_JOB = 'announcements.dispatch';

/**
 * Announcements are broadcasts with a validity window. A scheduled announcement is delivered by
 * the dispatch job once its start time passes, so a client can prepare messages in advance.
 * Delivery happens exactly once; `deliveredAt` is the guard.
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
  ) {
    this.jobs.register(
      ANNOUNCEMENT_DISPATCH_JOB,
      async () => {
        await this.dispatchDue();
      },
      { cron: '*/5 * * * *' },
    );
  }

  async list(query: {
    page: number;
    pageSize: number;
    q?: string;
    status?: AnnouncementStatus;
  }): Promise<Paginated<AnnouncementItem>> {
    const org = await this.tenant.getOrganization();
    const where = {
      organizationId: org.id,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' as const } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({
        where,
        orderBy: { startsAt: 'desc' },
        ...skipTake(query),
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return paginate(rows.map(toItem), total, query);
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
    const visible: AnnouncementItem[] = [];
    for (const row of rows) {
      const audience = audienceSchema.parse(row.audience ?? {});
      const recipients = await this.notifications.resolveAudience(audience);
      if (recipients.includes(user.id)) visible.push(toItem(row));
    }
    return visible.slice(0, 5);
  }

  async create(input: AnnouncementCreateInput, actor: AuthUser): Promise<AnnouncementItem> {
    const org = await this.tenant.getOrganization();
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
    const startsAt = patch.startsAt ? new Date(patch.startsAt) : before.startsAt;
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
    return toItem(row);
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

function toItem(row: {
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
  createdAt: Date;
}): AnnouncementItem {
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
    createdAt: row.createdAt.toISOString(),
  };
}
