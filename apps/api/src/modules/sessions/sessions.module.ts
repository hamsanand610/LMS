import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/index.js';
import { SessionRemindersService } from './reminders.service.js';
import {
  BatchScheduleController,
  MyScheduleController,
  SeriesController,
  SessionsController,
} from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [
    BatchScheduleController,
    SeriesController,
    SessionsController,
    MyScheduleController,
  ],
  providers: [SessionsService, SessionRemindersService],
  exports: [SessionsService],
})
export class SessionsModule {}
