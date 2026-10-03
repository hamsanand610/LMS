import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  announcementCreateSchema,
  announcementListQuerySchema,
  announcementUpdateSchema,
  audienceSchema,
  broadcastSchema,
  notificationListQuerySchema,
  notificationReadAllQuerySchema,
  notificationReadPageSchema,
  notificationPreferencesUpdateSchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import {
  AuthenticatedOnly,
  CurrentUser,
  ModuleScope,
  RequirePermission,
} from '../../core/auth/decorators.js';
import { RateLimit } from '../../core/rate-limit/rate-limit.decorator.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { AnnouncementsService } from './announcements.service.js';
import { NotificationsService } from './notifications.service.js';

const idSchema = z.uuid();

/** The signed-in person's own notification centre. */
@ApiTags('notifications')
@Controller('me/notifications')
@ModuleScope('notifications')
export class MyNotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly announcements: AnnouncementsService,
  ) {}

  @AuthenticatedOnly()
  @Get()
  async list(
    @Query({ schema: notificationListQuerySchema })
    query: z.infer<typeof notificationListQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    const page = await this.notifications.list(user.id, query);
    // An announcement or a broadcast has no page but this one: shown here in full, it has been
    // read (Phase 5). Only the ones on this page; the answer still shows how they stood.
    await this.notifications.markShown(
      user.id,
      page.data.filter((n) => n.link === '/notifications' && !n.readAt).map((n) => n.id),
    );
    return page;
  }

  /**
   * A page that loads its subject from a list (a test's instructions, a feedback form) says it
   * has been opened, so the notices that lead to it are read (Phase 5). Only the caller's own.
   */
  @AuthenticatedOnly()
  @Post('read-page')
  @HttpCode(200)
  async readPage(
    @Body({ schema: notificationReadPageSchema }) body: z.infer<typeof notificationReadPageSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return { marked: await this.notifications.markReadAt(user.id, body.path) };
  }

  /** Bell badge: unread count plus the newest few, in one call. */
  @AuthenticatedOnly()
  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.notifications.summary(user);
  }

  @AuthenticatedOnly()
  @Get('announcements')
  activeAnnouncements(@CurrentUser() user: AuthUser) {
    return this.announcements.activeFor(user);
  }

  @AuthenticatedOnly()
  @Get('preferences')
  preferences(@CurrentUser() user: AuthUser) {
    return this.notifications.preferences(user.id);
  }

  @AuthenticatedOnly()
  @Patch('preferences')
  setPreferences(
    @Body({ schema: notificationPreferencesUpdateSchema })
    body: z.infer<typeof notificationPreferencesUpdateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notifications.setPreferences(user.id, body.preferences);
  }

  @AuthenticatedOnly()
  @Post('read-all')
  @HttpCode(200)
  async markAllRead(
    @Query({ schema: notificationReadAllQuerySchema })
    query: z.infer<typeof notificationReadAllQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return { marked: await this.notifications.markAllRead(user.id, query.category) };
  }

  @AuthenticatedOnly()
  @Patch(':id/read')
  @HttpCode(204)
  async markRead(
    @Param('id', { schema: idSchema }) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.notifications.markRead(user.id, id);
  }
}

/** Staff-side broadcasting. */
@ApiTags('notifications')
@Controller('notifications')
@ModuleScope('notifications')
export class BroadcastController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly scope: ScopeService,
  ) {}

  /** Audited, and limited per sender: a broadcast reaches many people at once (D7). */
  @RequirePermission('notifications:broadcast')
  @RateLimit({ points: 20, durationSec: 3600, keyBy: 'user' })
  @Post('broadcast')
  @HttpCode(202)
  async broadcast(
    @Body({ schema: broadcastSchema }) body: z.infer<typeof broadcastSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    const allowed = await this.scope.visibleBatchIds(user, 'notifications:broadcast');
    return this.notifications.broadcast(body, allowed, user);
  }

  /** How many people an audience reaches, shown before sending. */
  @RequirePermission('notifications:broadcast')
  @Post('broadcast/preview')
  @HttpCode(200)
  async preview(
    @Body({ schema: z.object({ audience: audienceSchema }) })
    body: { audience: z.infer<typeof audienceSchema> },
    @CurrentUser() user: AuthUser,
  ) {
    const allowed = await this.scope.visibleBatchIds(user, 'notifications:broadcast');
    return { recipients: (await this.notifications.recipientsFor(body.audience, allowed)).length };
  }
}

@ApiTags('notifications')
@Controller('announcements')
@ModuleScope('notifications')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @RequirePermission('announcements:manage')
  @Get()
  list(
    @Query({ schema: announcementListQuerySchema })
    query: z.infer<typeof announcementListQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.announcements.list(query, user);
  }

  /** Reaches everyone it names, by e-mail too: a few at a time (Phase 6). */
  @RequirePermission('announcements:manage')
  @RateLimit({ points: 20, durationSec: 600, keyBy: 'user' })
  @Post()
  create(
    @Body({ schema: announcementCreateSchema }) body: z.infer<typeof announcementCreateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.announcements.create(body, user);
  }

  @RequirePermission('announcements:manage')
  @Patch(':id')
  update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: announcementUpdateSchema }) body: z.infer<typeof announcementUpdateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.announcements.update(id, body, user);
  }

  @RequirePermission('announcements:manage')
  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id', { schema: idSchema }) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.announcements.remove(id, user);
  }
}
