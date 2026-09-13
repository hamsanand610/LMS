import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { AnnouncementsService } from './announcements.service.js';
import {
  AnnouncementsController,
  BroadcastController,
  MyNotificationsController,
} from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [SettingsModule],
  controllers: [MyNotificationsController, BroadcastController, AnnouncementsController],
  providers: [NotificationsService, AnnouncementsService],
  exports: [NotificationsService, AnnouncementsService],
})
export class NotificationsModule {}
