import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/index.js';
import { SettingsModule } from '../settings/index.js';
import { AttendanceAlertsService } from './attendance-alerts.service.js';
import {
  AttendanceController,
  MeAttendanceController,
  SessionAttendanceController,
} from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';

@Module({
  imports: [NotificationsModule, SettingsModule],
  controllers: [SessionAttendanceController, AttendanceController, MeAttendanceController],
  providers: [AttendanceService, AttendanceAlertsService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
