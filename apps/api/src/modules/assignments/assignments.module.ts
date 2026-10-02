import { Module } from '@nestjs/common';
import { ExecutionModule } from '../execution/index.js';
import { NotificationsModule } from '../notifications/index.js';
import { QuestionsModule } from '../questions/index.js';
import { SettingsModule } from '../settings/settings.module.js';
import {
  AssignmentsController,
  MyAssignmentsController,
  SubmissionsController,
} from './assignments.controller.js';
import { DueRemindersService } from './due-reminders.service.js';
import { AssignmentsService } from './assignments.service.js';
import { AssignmentInsightsService } from './insights.service.js';
import { LearnerAssignmentsService } from './learner-assignments.service.js';
import { SubmissionViewsService } from './submission-views.service.js';
import { SubmissionsService } from './submissions.service.js';

@Module({
  imports: [QuestionsModule, ExecutionModule, NotificationsModule, SettingsModule],
  controllers: [AssignmentsController, SubmissionsController, MyAssignmentsController],
  providers: [
    AssignmentsService,
    LearnerAssignmentsService,
    SubmissionViewsService,
    SubmissionsService,
    AssignmentInsightsService,
    DueRemindersService,
  ],
  exports: [AssignmentsService, SubmissionsService, LearnerAssignmentsService],
})
export class AssignmentsModule {}
