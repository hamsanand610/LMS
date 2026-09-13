import { Injectable, Logger } from '@nestjs/common';
import {
  type Audience,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationItem,
  type NotificationPreference,
  type Paginated,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { EmailService } from '../../core/email/email.service.js';
import { notificationEmail } from '../../core/email/templates.js';
import { paginate, skipTake } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { JobsService } from '../../core/queue/jobs.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { BrandingService } from '../settings/branding.service.js';

export const NOTIFICATION_DELIVER_JOB = 'notifications.deliver';

/** One message aimed at a set of people. */
export interface DeliveryRequest {
  category: NotificationCategory;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  data?: Record<string, unknown>;
  channels: NotificationChannel[];
  /** Explicit recipients; when absent, `audience` is resolved. */
  userIds?: string[];
  audience?: Audience;
}

/** Channel defaults when a user has not chosen for a category. */
const DEFAULT_PREFERENCES: Record<NotificationCategory, { inApp: boolean; email: boolean }> = {
  account: { inApp: true, email: true },
  batch: { inApp: true, email: true },
  announcement: { inApp: true, email: false },
  content: { inApp: true, email: false },
  assessment: { inApp: true, email: true },
  attendance: { inApp: true, email: false },
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly email: EmailService,
    private readonly branding: BrandingService,
    private readonly jobs: JobsService,
  ) {
    this.jobs.register<DeliveryRequest>(NOTIFICATION_DELIVER_JOB, async (request) => {
      await this.deliverNow(request);
    });
  }

  // ───────────────────────── reading ─────────────────────────

  async list(
    userId: string,
    query: { page: number; pageSize: number; category?: NotificationCategory; unread?: boolean },
  ): Promise<Paginated<NotificationItem>> {
    const where = {
      userId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.unread ? { readAt: null } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        // Unread first, then newest, so the centre always opens on what needs attention.
        orderBy: [{ readAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
        ...skipTake(query),
      }),
      this.prisma.notification.count({ where }),
    ]);
    return paginate(
      rows.map((row) => ({
        id: row.id,
        category: row.category as NotificationCategory,
        type: row.type,
        title: row.title,
        body: row.body,
        link: row.link,
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      query,
    );
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  }

  async preferences(userId: string): Promise<NotificationPreference[]> {
    const rows = await this.prisma.notificationPreference.findMany({ where: { userId } });
    const stored = new Map(rows.map((r) => [r.category, r]));
    return NOTIFICATION_CATEGORIES.map((category) => {
      const row = stored.get(category);
      const defaults = DEFAULT_PREFERENCES[category];
      return {
        category,
        inApp: row?.inApp ?? defaults.inApp,
        email: row?.email ?? defaults.email,
      };
    });
  }

  async setPreferences(
    userId: string,
    preferences: NotificationPreference[],
  ): Promise<NotificationPreference[]> {
    for (const preference of preferences) {
      await this.prisma.notificationPreference.upsert({
        where: { userId_category: { userId, category: preference.category } },
        create: {
          userId,
          category: preference.category,
          inApp: preference.inApp,
          email: preference.email,
        },
        update: { inApp: preference.inApp, email: preference.email },
      });
    }
    return this.preferences(userId);
  }

  // ───────────────────────── delivery ─────────────────────────

  /** Queues a delivery so a large audience never blocks the request. */
  async deliver(request: DeliveryRequest): Promise<void> {
    await this.jobs.enqueue(NOTIFICATION_DELIVER_JOB, request, { retryLimit: 3 });
  }

  /** Resolves recipients, writes in-app rows and queues emails. Returns the number reached. */
  async deliverNow(request: DeliveryRequest): Promise<number> {
    const userIds = request.userIds ?? (await this.resolveAudience(request.audience ?? {}));
    if (userIds.length === 0) return 0;
    const wantsInApp = request.channels.includes('in_app');
    const wantsEmail = request.channels.includes('email');
    const preferences = await this.preferencesFor(userIds, request.category);

    const inAppRecipients = userIds.filter(
      (id) => wantsInApp && preferences.get(id)?.inApp !== false,
    );
    if (inAppRecipients.length > 0) {
      await this.prisma.notification.createMany({
        data: inAppRecipients.map((userId) => ({
          userId,
          category: request.category,
          type: request.type,
          title: request.title,
          body: request.body,
          link: request.link ?? null,
          data: (request.data ?? {}) as object,
        })),
      });
    }

    if (wantsEmail) {
      const emailRecipients = userIds.filter((id) => preferences.get(id)?.email !== false);
      if (emailRecipients.length > 0) {
        const users = await this.prisma.user.findMany({
          where: { id: { in: emailRecipients }, deletedAt: null },
          select: { email: true, name: true },
        });
        const brand = await this.branding.emailBrand();
        const config = await this.tenant.getOrganization();
        for (const user of users) {
          const message = notificationEmail(brand, {
            name: user.name,
            title: request.title,
            body: request.body,
            link: request.link ?? null,
          });
          await this.email.queue({ to: user.email, ...message });
        }
        this.logger.log(
          { count: users.length, type: request.type, client: config.key },
          'Notification emails queued',
        );
      }
    }
    return userIds.length;
  }

  /**
   * Turns an audience into user ids. An empty audience means every active account.
   * Filters combine with OR: anyone matching a role, a batch or a programme is included.
   */
  async resolveAudience(audience: Audience | Record<string, never>): Promise<string[]> {
    const org = await this.tenant.getOrganization();
    const roleKeys = 'roleKeys' in audience ? (audience.roleKeys ?? []) : [];
    const batchIds = 'batchIds' in audience ? (audience.batchIds ?? []) : [];
    const programIds = 'programIds' in audience ? (audience.programIds ?? []) : [];

    if (roleKeys.length === 0 && batchIds.length === 0 && programIds.length === 0) {
      const everyone = await this.prisma.user.findMany({
        where: { organizationId: org.id, deletedAt: null, status: { in: ['active', 'invited'] } },
        select: { id: true },
      });
      return everyone.map((u) => u.id);
    }

    const ids = new Set<string>();
    if (roleKeys.length > 0) {
      const byRole = await this.prisma.user.findMany({
        where: {
          organizationId: org.id,
          deletedAt: null,
          status: { in: ['active', 'invited'] },
          roles: { some: { role: { key: { in: roleKeys } } } },
        },
        select: { id: true },
      });
      for (const user of byRole) ids.add(user.id);
    }
    if (batchIds.length > 0 || programIds.length > 0) {
      const members = await this.prisma.batchMember.findMany({
        where: {
          isActive: true,
          OR: [
            ...(batchIds.length > 0 ? [{ batchId: { in: batchIds } }] : []),
            ...(programIds.length > 0 ? [{ batch: { programId: { in: programIds } } }] : []),
          ],
        },
        select: { student: { select: { userId: true } } },
      });
      for (const member of members) ids.add(member.student.userId);
      const trainers = await this.prisma.batchTrainer.findMany({
        where: {
          OR: [
            ...(batchIds.length > 0 ? [{ batchId: { in: batchIds } }] : []),
            ...(programIds.length > 0 ? [{ batch: { programId: { in: programIds } } }] : []),
          ],
        },
        select: { trainer: { select: { userId: true } } },
      });
      for (const assignment of trainers) ids.add(assignment.trainer.userId);
    }
    return [...ids];
  }

  /** Audience size without delivering, for the "this will reach N people" hint. */
  async audienceSize(audience: Audience): Promise<number> {
    return (await this.resolveAudience(audience)).length;
  }

  /**
   * Restricts an audience to what a `batch`-scoped sender may reach.
   * Returns null when nothing remains: an empty batch list would otherwise mean "everyone".
   */
  narrowAudienceToScope(audience: Audience, allowedBatchIds: string[] | null): Audience | null {
    if (allowedBatchIds === null) return audience;
    const batchIds =
      audience.batchIds.length === 0
        ? allowedBatchIds
        : audience.batchIds.filter((id) => allowedBatchIds.includes(id));
    if (batchIds.length === 0) return null;
    return { roleKeys: audience.roleKeys, batchIds, programIds: [] };
  }

  private async preferencesFor(
    userIds: string[],
    category: NotificationCategory,
  ): Promise<Map<string, { inApp: boolean; email: boolean }>> {
    const rows = await this.prisma.notificationPreference.findMany({
      where: { userId: { in: userIds }, category },
    });
    const defaults = DEFAULT_PREFERENCES[category];
    const map = new Map<string, { inApp: boolean; email: boolean }>();
    for (const userId of userIds) map.set(userId, { ...defaults });
    for (const row of rows) map.set(row.userId, { inApp: row.inApp, email: row.email });
    return map;
  }

  /** Convenience used by other modules for a single person. */
  async notifyUser(
    userId: string,
    request: Omit<DeliveryRequest, 'userIds' | 'audience'>,
  ): Promise<void> {
    await this.deliver({ ...request, userIds: [userId] });
  }

  /** Notifications the caller may see; used by the bell and the notification centre. */
  async summary(user: AuthUser): Promise<{ unread: number; latest: NotificationItem[] }> {
    const [unread, latest] = await Promise.all([
      this.unreadCount(user.id),
      this.list(user.id, { page: 1, pageSize: 5 }),
    ]);
    return { unread, latest: latest.data };
  }
}
