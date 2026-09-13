import { z } from 'zod';
import type { SessionItem } from './sessions.js';

/** One course as a learner sees it in their catalogue and progress list. */
export interface CourseProgress {
  courseId: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  subject: string;
  level: string;
  lessonCount: number;
  completedLessons: number;
  progressPct: number;
  status: 'not_started' | 'in_progress' | 'completed';
  nextLessonId: string | null;
  nextLessonTitle: string | null;
  lastAccessedAt: string | null;
}

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  link: string | null;
  occurredAt: string;
}

/** `GET /me/progress` — the learner's own picture, and the one staff see for a student. */
export interface ProgressOverview {
  overall: {
    courses: number;
    completedCourses: number;
    lessons: number;
    completedLessons: number;
    progressPct: number;
    minutesWatched: number;
  };
  courses: CourseProgress[];
  activity: ActivityItem[];
  /** Named so the page can say which figures are not measurable yet. */
  pending: { key: string; label: string; reason: string }[];
}

/** `GET /me/dashboard` — the student home aggregate. */
export interface StudentDashboard {
  today: SessionItem[];
  continueLearning: CourseProgress[];
  progress: ProgressOverview['overall'];
  announcements: { id: string; title: string; body: string; startsAt: string }[];
  unreadNotifications: number;
  batches: { id: string; code: string; name: string; status: string }[];
  pending: { key: string; label: string; reason: string }[];
}

export const progressQuerySchema = z.object({
  /** Staff use this to look at one student; learners always see their own. */
  studentId: z.uuid().optional(),
});
