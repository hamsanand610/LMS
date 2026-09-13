import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/index.js';
import { SettingsModule } from '../settings/settings.module.js';
import { StudentDashboardService } from './dashboard.service.js';
import { EnrollmentService } from './enrollment.service.js';
import { LearnerAccessService } from './learner-access.service.js';
import { MeProgressController, StudentProgressController } from './progress.controller.js';
import { ProgressService } from './progress.service.js';

@Module({
  imports: [NotificationsModule, SettingsModule],
  controllers: [MeProgressController, StudentProgressController],
  providers: [ProgressService, EnrollmentService, LearnerAccessService, StudentDashboardService],
  exports: [ProgressService, EnrollmentService, LearnerAccessService],
})
export class ProgressModule {}
