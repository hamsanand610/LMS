import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SettingsModule } from '../settings/settings.module.js';
import { AnnouncementsService } from './announcements.service.js';
import {
  AnnouncementsController,
  BroadcastController,
  MyNotificationsController,
} from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { ReadsNoticesInterceptor } from './reads-notices.js';

@Module({
  imports: [SettingsModule],
  controllers: [MyNotificationsController, BroadcastController, AnnouncementsController],
  providers: [
    NotificationsService,
    AnnouncementsService,
    // Opening a page reads the notices that lead to it, wherever @ReadsNotices says so (Phase 5).
    { provide: APP_INTERCEPTOR, useClass: ReadsNoticesInterceptor },
  ],
  exports: [NotificationsService, AnnouncementsService],
})
export class NotificationsModule {}
