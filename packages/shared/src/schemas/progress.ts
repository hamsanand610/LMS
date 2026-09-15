import { z } from 'zod';
import type { AttendanceSummary } from './attendance.js';
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

/** How a learner is doing on the assessment side. */
export interface AssessmentProgress {
  assignments: {
    total: number;
    questions: number;
    solved: number;
    awardedMarks: number;
    totalMarks: number;
    progressPct: number;
  };
  tests: {
    taken: number;
    averagePercentage: number;
    history: {
      testId: string;
      attemptId: string;
      title: string;
      score: number;
      totalMarks: number;
      percentage: number;
      released: boolean;
      submittedAt: string | null;
    }[];
  };
  practice: { solved: number; attempted: number; points: number };
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
  assessment: AssessmentProgress;
  /** Null when the learner is in no batch, so no class has been held for them. */
  attendance: AttendanceSummary | null;
  activity: ActivityItem[];
  /** Named so the page can say which figures are not measurable yet. */
  pending: { key: string; label: string; reason: string }[];
}

/** `GET /me/dashboard` — the student home aggregate. */
export interface StudentDashboard {
  today: SessionItem[];
  continueLearning: CourseProgress[];
  progress: ProgressOverview['overall'];
  /** What is due soon: assignments with a date, and tests whose window is open or close. */
  tasks: {
    kind: 'assignment' | 'test';
    id: string;
    title: string;
    dueAt: string | null;
    link: string;
    status: string;
  }[];
  announcements: { id: string; title: string; body: string; startsAt: string }[];
  attendance: AttendanceSummary | null;
  unreadNotifications: number;
  batches: { id: string; code: string; name: string; status: string }[];
  pending: { key: string; label: string; reason: string }[];
}

export const progressQuerySchema = z.object({
  /** Staff use this to look at one student; learners always see their own. */
  studentId: z.uuid().optional(),
});
