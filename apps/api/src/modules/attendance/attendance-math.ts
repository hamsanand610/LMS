import type { AttendanceStatus, AttendanceSummary } from '@lms/shared';
import { ATTENDANCE_STATUSES } from '@lms/shared';

/**
 * The attendance formula, on its own so it can be tested against a known dataset (plan
 * FR-05.3, AC-05.3) and so the learner's page, the trainer's roll call and every report
 * compute the same number from the same rule.
 *
 * Two rules do the work:
 *  - only a class that has been marked counts as conducted, because an unmarked class says
 *    nothing about whether anybody turned up;
 *  - which statuses count as attended is a setting, so an institute that does not forgive
 *    lateness changes one field rather than the code.
 */

export interface AttendanceCountInput {
  counts: Partial<Record<AttendanceStatus, number>>;
  countedStatuses: readonly AttendanceStatus[];
  thresholdPct: number;
}

export function emptyCounts(): Record<AttendanceStatus, number> {
  return { present: 0, absent: 0, late: 0, excused: 0 };
}

/** Counts a list of marks by status, ignoring nothing and inventing nothing. */
export function countByStatus(
  statuses: readonly AttendanceStatus[],
): Record<AttendanceStatus, number> {
  const counts = emptyCounts();
  for (const status of statuses) counts[status] += 1;
  return counts;
}

/** Percentage rounded to whole numbers, or null when no class has been conducted. */
export function attendancePercentage(attended: number, conducted: number): number | null {
  if (conducted <= 0) return null;
  return Math.round((attended / conducted) * 100);
}

export function summarise(input: AttendanceCountInput): AttendanceSummary {
  const counts = emptyCounts();
  for (const status of ATTENDANCE_STATUSES) counts[status] = input.counts[status] ?? 0;

  const conducted = ATTENDANCE_STATUSES.reduce((total, status) => total + counts[status], 0);
  const attended = input.countedStatuses.reduce((total, status) => total + counts[status], 0);
  const percentage = attendancePercentage(attended, conducted);

  return {
    conducted,
    attended,
    percentage,
    counts,
    countedStatuses: [...input.countedStatuses],
    thresholdPct: input.thresholdPct,
    // Nobody is below a threshold they have had no chance to meet.
    belowThreshold: percentage !== null && percentage < input.thresholdPct,
  };
}
