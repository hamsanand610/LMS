import {
  type SeriesCreateInput,
  type SessionConflict,
  dateKeysBetween,
  weekdayOfDateKey,
  zonedDateTimeToUtc,
} from '@lms/shared';

export interface Occurrence {
  /** Calendar date in the institute's timezone. */
  dateKey: string;
  startsAt: Date;
  endsAt: Date;
}

/** The most sessions one series may create, so a mistyped date range cannot flood the timetable. */
export const MAX_OCCURRENCES = 400;

/**
 * Expands "Mondays and Thursdays, 10:00–11:30, from the 1st to the 30th" into dated classes.
 * Times are wall-clock in the institute's timezone; what is stored is the UTC instant.
 */
export function generateOccurrences(
  input: Pick<
    SeriesCreateInput,
    'weekdays' | 'startsTime' | 'endsTime' | 'fromDate' | 'untilDate' | 'skipDates'
  >,
  timeZone: string,
): Occurrence[] {
  const wanted = new Set(input.weekdays);
  const skipped = new Set(input.skipDates);
  const occurrences: Occurrence[] = [];
  for (const dateKey of dateKeysBetween(input.fromDate, input.untilDate)) {
    if (!wanted.has(weekdayOfDateKey(dateKey))) continue;
    if (skipped.has(dateKey)) continue;
    occurrences.push({
      dateKey,
      startsAt: zonedDateTimeToUtc(dateKey, input.startsTime, timeZone),
      endsAt: zonedDateTimeToUtc(dateKey, input.endsTime, timeZone),
    });
    if (occurrences.length >= MAX_OCCURRENCES) break;
  }
  return occurrences;
}

export interface ScheduledSpan {
  id: string;
  startsAt: Date;
  endsAt: Date;
  /** What the clash is with, for the message the editor shows. */
  label: string;
}

function overlaps(
  a: { startsAt: Date; endsAt: Date },
  b: { startsAt: Date; endsAt: Date },
): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/**
 * Clashes between new classes and what is already scheduled. The timetable reports them before
 * writing anything, so the person choosing the times decides rather than the system silently
 * double-booking a trainer or a batch.
 */
export function findConflicts(
  occurrences: Occurrence[],
  existing: ScheduledSpan[],
): SessionConflict[] {
  const conflicts: SessionConflict[] = [];
  for (const occurrence of occurrences) {
    for (const span of existing) {
      if (!overlaps(occurrence, span)) continue;
      conflicts.push({
        startsAt: occurrence.startsAt.toISOString(),
        reason: span.label,
        withSessionId: span.id,
      });
      break;
    }
  }
  return conflicts;
}

/** Clashes inside one proposed set, which happens when two series are created for the same slot. */
export function findInternalConflicts(occurrences: Occurrence[]): SessionConflict[] {
  const conflicts: SessionConflict[] = [];
  for (let i = 0; i < occurrences.length; i += 1) {
    for (let j = i + 1; j < occurrences.length; j += 1) {
      if (overlaps(occurrences[i] as Occurrence, occurrences[j] as Occurrence)) {
        conflicts.push({
          startsAt: (occurrences[j] as Occurrence).startsAt.toISOString(),
          reason: 'Two classes in this series fall at the same time',
          withSessionId: '',
        });
      }
    }
  }
  return conflicts;
}
