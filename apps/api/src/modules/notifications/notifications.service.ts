import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type Audience,
  type BroadcastInput,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationItem,
  type NotificationPreference,
  type Paginated,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { APP_CONFIG, type AppConfig } from '../../core/config/env.js';
import { EmailService } from '../../core/email/email.service.js';
import { notificationEmail } from '../../core/email/templates.js';
import { paginate, skipTake } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { JobsService } from '../../core/queue/jobs.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { BrandingService } from '../settings/branding.service.js';
import { EmailTemplatesService } from '../settings/email-templates.service.js';

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
  placement: { inApp: true, email: true },
  support: { inApp: true, email: true },
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly email: EmailService,
    private readonly branding: BrandingService,
    private readonly templates: EmailTemplatesService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
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
      // `unread=true` the unread ones, `unread=false` the read ones, neither everything.
      ...(query.unread === undefined
        ? {}
        : query.unread
          ? { readAt: null }
          : { readAt: { not: null } }),
    };
    // Two plain reads rather than a transaction: the bell polls this on every page, and a
    // transaction must wait for a connection of its own, which under load fails after two seconds.
    const [rows, total] = await Promise.all([
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

  /**
   * Whether a notice of this type has already gone out for this subject (a publication, a test
   * window), so a scheduled reminder is sent once however often its job runs.
   */
  async alreadySent(type: string, key: string, value: string): Promise<boolean> {
    const row = await this.prisma.notification.findFirst({
      where: { type, data: { path: [key], equals: value } },
      select: { id: true },
    });
    return row !== null;
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

  /**
   * Marks read the caller's notices that lead to one page, once they have opened it (Phase 5):
   * a reply read in its thread is not left waiting in the bell. `path` is the page's own part of
   * the link (`/doubts/<id>`), so the portal it was sent for does not matter.
   */
  async markReadAt(userId: string, path: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null, link: { endsWith: path } },
      data: { readAt: new Date() },
    });
    return result.count;
  }

  /** Everything unread, or only one category when the centre is filtered to it. */
  async markAllRead(userId: string, category?: NotificationCategory): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(category ? { category } : {}) },
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

  /** A portal path as a full address (e-mail cannot follow a relative link). */
  private portalUrl(link: string): string {
    if (/^https?:\/\//.test(link)) return link;
    const base = this.config.WEB_BASE_URL.replace(/\/$/, '');
    return `${base}${link.startsWith('/') ? '' : '/'}${link}`;
  }

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

    // Account messages always arrive in the portal, as the preferences page promises.
    const inAppRecipients = userIds.filter(
      (id) =>
        wantsInApp && (request.category === 'account' || preferences.get(id)?.inApp !== false),
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
          const message = notificationEmail(
            brand,
            {
              name: user.name,
              title: request.title,
              body: request.body,
              // In-app links are portal paths; an e-mail needs the whole address to lead back.
              link: request.link ? this.portalUrl(request.link) : null,
            },
            await this.templates.resolve('notification', {
              name: user.name,
              brandName: brand.brandName,
              title: request.title,
            }),
          );
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

  /**
   * Sends a staff broadcast to an audience inside the sender's reach, and records it: a message to
   * many people under the institute's name is something the institute must be able to trace.
   */
  async broadcast(
    input: BroadcastInput,
    allowedBatchIds: string[] | null,
    actor: AuthUser,
  ): Promise<{ recipients: number }> {
    const recipients = await this.recipientsFor(input.audience, allowedBatchIds);
    if (recipients.length === 0) return { recipients: 0 };
    await this.deliver({
      category: 'announcement',
      type: 'staff.broadcast',
      title: input.title,
      body: input.body,
      link: input.link || null,
      channels: input.channels,
      userIds: recipients,
    });
    await this.audit.record({
      action: 'notifications.broadcast',
      resourceType: 'broadcast',
      summary: `“${input.title}” sent to ${recipients.length} ${recipients.length === 1 ? 'person' : 'people'}`,
      after: {
        title: input.title,
        audience: input.audience,
        channels: input.channels,
        recipients: recipients.length,
      },
      actorId: actor.id,
    });
    return { recipients: recipients.length };
  }

  /**
   * Who a broadcast reaches. An institute-wide sender reaches the audience as asked. A batch-scoped
   * sender reaches only the people in their own batches: the batches they pick narrow that, and so
   * do the roles they pick — a role never adds anybody from outside those batches.
   */
  async recipientsFor(audience: Audience, allowedBatchIds: string[] | null): Promise<string[]> {
    if (allowedBatchIds === null) return this.resolveAudience(audience);
    const batchIds =
      audience.batchIds.length === 0
        ? allowedBatchIds
        : audience.batchIds.filter((id) => allowedBatchIds.includes(id));
    // An empty batch list would otherwise mean "everyone".
    if (batchIds.length === 0) return [];
    const inBatches = await this.resolveAudience({ roleKeys: [], batchIds, programIds: [] });
    if (audience.roleKeys.length === 0 || inBatches.length === 0) return inBatches;
    const withRole = await this.prisma.user.findMany({
      where: {
        id: { in: inBatches },
        roles: { some: { role: { key: { in: audience.roleKeys } } } },
      },
      select: { id: true },
    });
    return withRole.map((user) => user.id);
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
