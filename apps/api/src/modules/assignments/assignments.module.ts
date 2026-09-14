import { Module } from '@nestjs/common';
import { ExecutionModule } from '../execution/index.js';
import { NotificationsModule } from '../notifications/index.js';
import { QuestionsModule } from '../questions/index.js';
import {
  AssignmentsController,
  MyAssignmentsController,
  SubmissionsController,
} from './assignments.controller.js';
import { AssignmentsService } from './assignments.service.js';
import { SubmissionsService } from './submissions.service.js';

@Module({
  imports: [QuestionsModule, ExecutionModule, NotificationsModule],
  controllers: [AssignmentsController, SubmissionsController, MyAssignmentsController],
  providers: [AssignmentsService, SubmissionsService],
  exports: [AssignmentsService, SubmissionsService],
})
export class AssignmentsModule {}
