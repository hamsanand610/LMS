import { Module } from '@nestjs/common';
import { ExecutionModule } from '../execution/index.js';
import { QuestionsModule } from '../questions/index.js';
import { LabDraftsService } from './lab-drafts.service.js';
import { LabsStaffController } from './labs-staff.controller.js';
import { LabsStaffService } from './labs-staff.service.js';
import { PlaygroundService } from './playground.service.js';
import { PracticeController } from './practice.controller.js';
import { PracticeService } from './practice.service.js';

@Module({
  imports: [ExecutionModule, QuestionsModule],
  controllers: [PracticeController, LabsStaffController],
  providers: [PracticeService, PlaygroundService, LabDraftsService, LabsStaffService],
  exports: [PracticeService, LabsStaffService],
})
export class PracticeModule {}
