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
  notificationPreferencesUpdateSchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import {
  AuthenticatedOnly,
  CurrentUser,
  ModuleScope,
  RequirePermission,
} from '../../core/auth/decorators.js';
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
  list(
    @Query({ schema: notificationListQuerySchema })
    query: z.infer<typeof notificationListQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notifications.list(user.id, query);
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
  async markAllRead(@CurrentUser() user: AuthUser) {
    return { marked: await this.notifications.markAllRead(user.id) };
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

  @RequirePermission('notifications:broadcast')
  @Post('broadcast')
  @HttpCode(202)
  async broadcast(
    @Body({ schema: broadcastSchema }) body: z.infer<typeof broadcastSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    const allowed = await this.scope.visibleBatchIds(user, 'notifications:broadcast');
    const recipients = await this.notifications.recipientsFor(body.audience, allowed);
    if (recipients.length === 0) return { recipients: 0 };
    await this.notifications.deliver({
      category: 'announcement',
      type: 'staff.broadcast',
      title: body.title,
      body: body.body,
      link: body.link || null,
      channels: body.channels,
      userIds: recipients,
    });
    return { recipients: recipients.length };
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
  ) {
    return this.announcements.list(query);
  }

  @RequirePermission('announcements:manage')
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
