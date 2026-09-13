import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/index.js';
import { ProgressModule } from '../progress/index.js';
import { SettingsModule } from '../settings/settings.module.js';
import {
  CoursesController,
  LessonsController,
  MyCoursesController,
  RecordingsController,
} from './courses.controller.js';
import { CoursesService } from './courses.service.js';
import { LessonsService } from './lessons.service.js';
import { RecordingsService } from './recordings.service.js';
import { VideoService } from './video.driver.js';

@Module({
  imports: [ProgressModule, NotificationsModule, SettingsModule],
  controllers: [CoursesController, LessonsController, MyCoursesController, RecordingsController],
  providers: [CoursesService, LessonsService, RecordingsService, VideoService],
  exports: [CoursesService, LessonsService],
})
export class CoursesModule {}
