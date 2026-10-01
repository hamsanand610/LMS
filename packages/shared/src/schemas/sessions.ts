import { z } from 'zod';
import { optionalWebUrlSchema, paginationQuerySchema, webUrlOrEmptySchema } from './common.js';

export const SESSION_STATUSES = ['scheduled', 'live', 'completed', 'cancelled'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const SESSION_PROVIDERS = ['none', 'meet', 'zoom', 'teams', 'other'] as const;
export type SessionProvider = (typeof SESSION_PROVIDERS)[number];

/** Days of the week a series runs on, Monday first to match the timetable UI. */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** `HH:MM` in the institute's timezone. */
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time such as 10:00');

export const seriesCreateSchema = z
  .object({
    subject: z.string().trim().min(1).max(60),
    trainerId: z.uuid().nullable().default(null),
    weekdays: z.array(z.enum(WEEKDAYS)).min(1).max(7),
    startsTime: timeOfDaySchema,
    endsTime: timeOfDaySchema,
    fromDate: z.iso.date(),
    untilDate: z.iso.date(),
    joinUrl: optionalWebUrlSchema(500),
    provider: z.enum(SESSION_PROVIDERS).default('none'),
    /** Dates inside the range with no class (holidays). */
    skipDates: z.array(z.iso.date()).max(60).default([]),
    title: z.string().trim().max(160).default(''),
  })
  .refine((v) => v.endsTime > v.startsTime, {
    path: ['endsTime'],
    message: 'The class must end after it starts',
  })
  .refine((v) => v.untilDate >= v.fromDate, {
    path: ['untilDate'],
    message: 'The last date must not be before the first',
  });
export type SeriesCreateInput = z.infer<typeof seriesCreateSchema>;

/** A one-off class, outside any repeating series. */
export const sessionCreateSchema = z
  .object({
    subject: z.string().trim().min(1).max(60),
    title: z.string().trim().max(160).default(''),
    trainerId: z.uuid().nullable().default(null),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    joinUrl: optionalWebUrlSchema(500),
    provider: z.enum(SESSION_PROVIDERS).default('none'),
    notes: z.string().trim().max(1000).default(''),
  })
  .refine((v) => v.endsAt > v.startsAt, {
    path: ['endsAt'],
    message: 'The class must end after it starts',
  });
export type SessionCreateInput = z.infer<typeof sessionCreateSchema>;

export const sessionUpdateSchema = z.object({
  title: z.string().trim().max(160).optional(),
  startsAt: z.iso.datetime().optional(),
  endsAt: z.iso.datetime().optional(),
  joinUrl: webUrlOrEmptySchema(500).optional(),
  trainerId: z.uuid().nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const sessionStatusSchema = z.object({
  status: z.enum(SESSION_STATUSES),
  reason: z.string().trim().max(240).default(''),
});

export const recordingSchema = z
  .object({
    fileId: z.uuid().nullable().default(null),
    url: optionalWebUrlSchema(500),
    courseId: z.uuid(),
    moduleTitle: z.string().trim().max(160).default('Recordings'),
  })
  .refine((v) => v.fileId !== null || v.url.length > 0, {
    path: ['fileId'],
    message: 'Attach an uploaded recording or give a link',
  });
export type RecordingInput = z.infer<typeof recordingSchema>;

export const scheduleRangeSchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export const sessionListQuerySchema = paginationQuerySchema.extend({
  batchId: z.uuid().optional(),
  trainerId: z.uuid().optional(),
  status: z.enum(SESSION_STATUSES).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export interface SessionSeriesSummary {
  id: string;
  batchId: string;
  subject: string;
  trainerId: string | null;
  trainerName: string | null;
  weekdays: Weekday[];
  startsTime: string;
  endsTime: string;
  fromDate: string;
  untilDate: string;
  provider: SessionProvider;
  joinUrl: string;
  skipDates: string[];
  sessionCount: number;
  active: boolean;
}

export interface SessionItem {
  id: string;
  seriesId: string | null;
  batchId: string;
  batchCode: string;
  subject: string;
  title: string;
  trainerId: string | null;
  trainerName: string | null;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  joinUrl: string;
  provider: SessionProvider;
  notes: string;
  recordingLessonId: string | null;
  recordingCourseId: string | null;
  /** True while the join link should be offered (from fifteen minutes before until the end). */
  joinable: boolean;
}

/** What a proposed series would create, shown for confirmation before anything is written. */
export interface SeriesPreview {
  occurrences: { startsAt: string; endsAt: string }[];
  conflicts: SessionConflict[];
}

/** A clash the timetable editor reports before it writes anything. */
export interface SessionConflict {
  startsAt: string;
  reason: string;
  withSessionId: string;
}
