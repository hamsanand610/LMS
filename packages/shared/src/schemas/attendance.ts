import { z } from 'zod';
import { paginationQuerySchema } from './common.js';

/**
 * How a student is recorded against one class. The reference portal also shows "week off" and
 * "holiday"; here those are the absence of a class rather than a mark against a student, because
 * a holiday is a property of the timetable (a skipped date) and not of anybody's attendance.
 */
export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused',
};

// ───────────────────────── marking ─────────────────────────

export const attendanceRecordInputSchema = z.object({
  studentId: z.uuid(),
  status: z.enum(ATTENDANCE_STATUSES),
  note: z.string().trim().max(300).default(''),
});
export type AttendanceRecordInput = z.infer<typeof attendanceRecordInputSchema>;

export const attendanceMarkSchema = z.object({
  records: z.array(attendanceRecordInputSchema).min(1).max(500),
  /**
   * Why a mark that was already taken is being changed. The API refuses a correction without
   * one (plan FR-05.2, AC-05.2); it is ignored on a first marking.
   */
  reason: z.string().trim().max(300).default(''),
});
export type AttendanceMarkInput = z.infer<typeof attendanceMarkSchema>;

export interface AttendanceMarkResult {
  marked: number;
  corrected: number;
  unchanged: number;
  markedAt: string;
}

// ───────────────────────── one session ─────────────────────────

export interface SessionAttendanceStudent {
  studentId: string;
  studentCode: string;
  name: string;
  email: string;
  /** null until somebody has taken the roll call. */
  status: AttendanceStatus | null;
  note: string;
  markedAt: string | null;
  markedByName: string | null;
  correctedAt: string | null;
  correctedByName: string | null;
  correctionReason: string;
  /** This student's running percentage in the batch, so a trainer sees who is slipping. */
  attendancePct: number | null;
}

export interface SessionAttendanceView {
  session: {
    id: string;
    batchId: string;
    batchCode: string;
    batchName: string;
    subject: string;
    title: string;
    startsAt: string;
    endsAt: string;
    status: string;
    trainerName: string | null;
  };
  /** False when the class has not happened yet, or the window has closed for this caller. */
  canMark: boolean;
  /** Why marking is refused, in a sentence the page can show as it stands. */
  blockedReason: string | null;
  markedAt: string | null;
  markedByName: string | null;
  /** Corrections need `attendance:manage` after this instant. Null once nothing is marked. */
  correctionWindowEndsAt: string | null;
  withinCorrectionWindow: boolean;
  /** Everything the page needs to explain the rules without asking the settings endpoint. */
  rules: {
    defaultStatus: AttendanceStatus;
    countedStatuses: AttendanceStatus[];
    thresholdPct: number;
    correctionWindowHours: number;
  };
  students: SessionAttendanceStudent[];
}

// ───────────────────────── a student's own record ─────────────────────────

export const attendanceRangeQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  subject: z.string().trim().max(60).optional(),
  batchId: z.uuid().optional(),
});
export type AttendanceRangeQuery = z.infer<typeof attendanceRangeQuerySchema>;

export interface AttendanceSummary {
  /** Classes that took place and were marked. An unmarked class counts for nobody. */
  conducted: number;
  attended: number;
  /** null when no class has been conducted yet; a percentage of nothing is not zero. */
  percentage: number | null;
  counts: Record<AttendanceStatus, number>;
  countedStatuses: AttendanceStatus[];
  thresholdPct: number;
  belowThreshold: boolean;
}

export interface AttendanceSubjectRow {
  subject: string;
  conducted: number;
  attended: number;
  percentage: number | null;
}

export interface AttendanceDayEntry {
  sessionId: string;
  subject: string;
  title: string;
  startsAt: string;
  endsAt: string;
  /** null for a class that happened but has not been marked. */
  status: AttendanceStatus | null;
  note: string;
  /** True while the class is still to come, so a calendar can grey it rather than call it missed. */
  upcoming: boolean;
  cancelled: boolean;
}

export interface AttendanceDay {
  date: string;
  entries: AttendanceDayEntry[];
}

export interface StudentAttendanceView {
  studentId: string;
  studentName: string;
  range: { from: string; to: string };
  summary: AttendanceSummary;
  bySubject: AttendanceSubjectRow[];
  days: AttendanceDay[];
}

// ───────────────────────── the sessions list ─────────────────────────

export const ATTENDANCE_SESSION_STATES = ['all', 'marked', 'unmarked'] as const;
export type AttendanceSessionState = (typeof ATTENDANCE_SESSION_STATES)[number];

export const attendanceSessionsQuerySchema = paginationQuerySchema.extend({
  batchId: z.uuid().optional(),
  trainerId: z.uuid().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  state: z.enum(ATTENDANCE_SESSION_STATES).default('all'),
});
export type AttendanceSessionsQuery = z.infer<typeof attendanceSessionsQuerySchema>;

export interface AttendanceSessionRow {
  sessionId: string;
  batchId: string;
  batchCode: string;
  batchName: string;
  subject: string;
  title: string;
  startsAt: string;
  endsAt: string;
  sessionStatus: string;
  trainerName: string | null;
  rosterSize: number;
  markedCount: number;
  presentCount: number;
  percentage: number | null;
  isMarked: boolean;
  markedAt: string | null;
  markedByName: string | null;
}

/** The low-attendance list an admin dashboard and a trainer dashboard both show. */
export interface AttendanceAlertRow {
  studentId: string;
  studentCode: string;
  name: string;
  batchId: string;
  batchCode: string;
  conducted: number;
  attended: number;
  percentage: number;
}
