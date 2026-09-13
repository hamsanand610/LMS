import type { SessionItem, SessionProvider, SessionStatus } from '@lms/shared';

/** How long before a class starts the join link is offered. */
export const JOIN_WINDOW_MINUTES = 15;

/**
 * The shape a session row must have to be presented. Structural rather than Prisma-typed so that
 * any module holding these columns can render a session without importing the schedule service.
 */
export interface SessionRowLike {
  id: string;
  seriesId: string | null;
  batchId: string;
  trainerId: string | null;
  subject: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  joinUrl: string;
  provider: string;
  status: string;
  notes: string;
  recordingLessonId: string | null;
  batch?: { code: string } | null;
  trainer?: { user?: { name: string } | null } | null;
  recordingLesson?: { module: { courseId: string } } | null;
}

/** True while the join link should be offered: shortly before the class until it ends. */
export function isJoinable(
  row: Pick<SessionRowLike, 'startsAt' | 'endsAt' | 'status' | 'joinUrl'>,
  now = new Date(),
): boolean {
  if (!row.joinUrl) return false;
  if (row.status === 'cancelled' || row.status === 'completed') return false;
  const opens = row.startsAt.getTime() - JOIN_WINDOW_MINUTES * 60_000;
  return now.getTime() >= opens && now.getTime() <= row.endsAt.getTime();
}

/** One session as every portal shows it. */
export function toSessionItem(row: SessionRowLike, now = new Date()): SessionItem {
  return {
    id: row.id,
    seriesId: row.seriesId,
    batchId: row.batchId,
    batchCode: row.batch?.code ?? '',
    subject: row.subject,
    title: row.title,
    trainerId: row.trainerId,
    trainerName: row.trainer?.user?.name ?? null,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: row.status as SessionStatus,
    joinUrl: row.joinUrl,
    provider: row.provider as SessionProvider,
    notes: row.notes,
    recordingLessonId: row.recordingLessonId,
    recordingCourseId: row.recordingLesson?.module.courseId ?? null,
    joinable: isJoinable(row, now),
  };
}

/** The relations `toSessionItem` reads. Shared so every query returns the same fields. */
export const SESSION_INCLUDE = {
  batch: { select: { code: true } },
  trainer: { select: { user: { select: { name: true } } } },
  recordingLesson: { select: { module: { select: { courseId: true } } } },
} as const;
