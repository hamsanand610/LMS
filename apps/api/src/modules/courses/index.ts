/** Public surface of the courses module. */
export { CoursesModule } from './courses.module.js';
export { type AiCourseContext, CoursesService } from './courses.service.js';
export { type AiLessonContext, LessonsService } from './lessons.service.js';
export {
  type CourseLearningState,
  CourseLearningStateService,
  type CourseLearningSummary,
  LEARNING_STATE_LIMITS,
  type LearningStateOverview,
} from './learning-state.service.js';
export { RecordingsService } from './recordings.service.js';
export { VideoService } from './video.driver.js';
export { coursesManifest } from './manifest.js';
