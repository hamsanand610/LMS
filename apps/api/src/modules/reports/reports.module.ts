import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/index.js';
import { NotificationsModule } from '../notifications/index.js';
import { DashboardService } from './dashboard.service.js';
import { ExportsService } from './exports.service.js';
import {
  ExportsController,
  ReportsController,
  TrainerDashboardController,
} from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { TrainerDashboardService } from './trainer-dashboard.service.js';

@Module({
  imports: [AttendanceModule, NotificationsModule],
  controllers: [ReportsController, ExportsController, TrainerDashboardController],
  providers: [DashboardService, ReportsService, ExportsService, TrainerDashboardService],
  exports: [DashboardService, ReportsService],
})
export class ReportsModule {}
