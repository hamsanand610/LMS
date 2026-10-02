import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/index.js';
import { PracticeModule } from '../practice/index.js';
import { ProgressModule } from '../progress/index.js';
import { QuestionsModule } from '../questions/index.js';
import { SettingsModule } from '../settings/settings.module.js';
import {
  CoursesController,
  LessonsController,
  MyCoursesController,
  RecordingsController,
} from './courses.controller.js';
import { CoursesService } from './courses.service.js';
import { LessonLabService } from './lesson-lab.service.js';
import { LessonPracticeService } from './lesson-practice.service.js';
import { LessonsService } from './lessons.service.js';
import { RecordingsService } from './recordings.service.js';
import { VideoService } from './video.driver.js';

@Module({
  imports: [ProgressModule, QuestionsModule, PracticeModule, NotificationsModule, SettingsModule],
  controllers: [CoursesController, LessonsController, MyCoursesController, RecordingsController],
  providers: [
    CoursesService,
    LessonsService,
    LessonPracticeService,
    LessonLabService,
    RecordingsService,
    VideoService,
  ],
  exports: [CoursesService, LessonsService],
})
export class CoursesModule {}
