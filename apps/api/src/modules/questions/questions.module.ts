import { Module } from '@nestjs/common';
import { ExecutionModule } from '../execution/index.js';
import { SettingsModule } from '../settings/settings.module.js';
import { QuestionImportService } from './import.service.js';
import { QuestionsController } from './questions.controller.js';
import { QuestionsService } from './questions.service.js';

@Module({
  imports: [ExecutionModule, SettingsModule],
  controllers: [QuestionsController],
  providers: [QuestionsService, QuestionImportService],
  exports: [QuestionsService],
})
export class QuestionsModule {}
