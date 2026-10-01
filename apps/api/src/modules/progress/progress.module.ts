import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/index.js';
import { NotificationsModule } from '../notifications/index.js';
import { SettingsModule } from '../settings/settings.module.js';
import { AssessmentProgressService } from './assessment-progress.service.js';
import { ConsistencyService } from './consistency.service.js';
import { StudentDashboardService } from './dashboard.service.js';
import { EnrollmentService } from './enrollment.service.js';
import { LearnerAccessService } from './learner-access.service.js';
import { MeProgressController, StudentProgressController } from './progress.controller.js';
import { ProgressService } from './progress.service.js';

@Module({
  imports: [AttendanceModule, NotificationsModule, SettingsModule],
  controllers: [MeProgressController, StudentProgressController],
  providers: [
    ProgressService,
    EnrollmentService,
    LearnerAccessService,
    StudentDashboardService,
    AssessmentProgressService,
    ConsistencyService,
  ],
  exports: [ProgressService, EnrollmentService, LearnerAccessService, ConsistencyService],
})
export class ProgressModule {}
