import { z } from 'zod';
import type { NotificationItem } from './notifications.js';
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
  /** Required lessons (every lesson when the author marked none optional), the percentage's base. */
  lessonCount: number;
  completedLessons: number;
  /** Extra lessons that do not count towards completion. */
  optionalLessons: number;
  progressPct: number;
  status: 'not_started' | 'in_progress' | 'completed';
  nextLessonId: string | null;
  nextLessonTitle: string | null;
  lastAccessedAt: string | null;
  moduleCount: number;
  /** Sum of the lessons' stated durations, in minutes. */
  durationMinutes: number;
  /** The trainers who teach this course's subject to the learner's batch. */
  instructors: string[];
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
  /** Assignments and tests, for the dashboard's progress card; null for somebody not a learner. */
  assessment: AssessmentProgress | null;
  unreadNotifications: number;
  /** The newest notifications, read or not, so the dashboard shows what arrived lately. */
  notifications: NotificationItem[];
  /** What the learner did lately: lessons, courses, assignments, tests and labs. */
  activity: ActivityItem[];
  /** Certificates the learner holds; null while certificates are switched off. */
  certificates: number | null;
  batches: { id: string; code: string; name: string; status: string }[];
  pending: { key: string; label: string; reason: string }[];
}

/** A date on the learner's schedule that is not a class: work due, or a test window closing. */
export interface ScheduleDeadline {
  kind: 'assignment' | 'test';
  id: string;
  title: string;
  /** When it is due, or when the test window closes. */
  at: string;
  link: string;
  /** Handed in in full, or the test sat. */
  done: boolean;
}

export const progressQuerySchema = z.object({
  /** Staff use this to look at one student; learners always see their own. */
  studentId: z.uuid().optional(),
});

// ───────────────────────── consistency (Task 2, ADR-0014) ─────────────────────────

/** One calendar day in the institute's time zone. */
export interface ActivityDay {
  /** YYYY-MM-DD */
  date: string;
  /** Learning activities recorded that day. */
  count: number;
}

export interface StreakSummary {
  /** Consecutive days with learning activity ending today (or yesterday, until today is done). */
  current: number;
  longest: number;
  activeToday: boolean;
  /** Days with activity in the last 365. */
  activeDays: number;
  lastActiveOn: string | null;
  /** The last 365 days, oldest first, for the heatmap. */
  days: ActivityDay[];
}

export type AdherenceDayStatus = 'met' | 'partial' | 'missed';

export interface AdherenceDay {
  date: string;
  status: AdherenceDayStatus;
  classesMarked: number;
  classesAttended: number;
  activities: number;
}

export interface AdherenceSummary {
  /** Met class days ÷ measured class days over the window, or null when none was measured. */
  percentage: number | null;
  windowDays: number;
  measuredDays: number;
  metDays: number;
  partialDays: number;
  missedDays: number;
  /** Today's target and how far it has got. */
  today: {
    classesScheduled: number;
    classesMarked: number;
    classesAttended: number;
    activityDone: boolean;
  };
  /** Measured class days in the window, newest first. */
  days: AdherenceDay[];
}

export interface LearningConsistency {
  streak: StreakSummary;
  /** The same rule counted over practice submissions only. */
  practiceStreak: { current: number; longest: number; activeToday: boolean };
  adherence: AdherenceSummary;
  /** Plain-language rules, shown beside the figures. */
  definitions: {
    activity: string[];
    streak: string;
    adherence: string;
  };
}
