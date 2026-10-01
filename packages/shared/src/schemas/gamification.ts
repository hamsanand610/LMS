import { z } from 'zod';

/**
 * The leaderboard (ADR-0014). Points come only from recorded work in the chosen period, the board
 * covers one batch, and a learner sees nothing about anybody but a short name and a total.
 */
export const LEADERBOARD_PERIODS = ['week', 'month', 'all'] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

export const LEADERBOARD_PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  week: 'This week',
  month: 'This month',
  all: 'All time',
};

/** How many points each kind of work is worth. Practice problems carry their own points. */
export const LEADERBOARD_POINTS = {
  lessonCompleted: 5,
} as const;

export const leaderboardQuerySchema = z.object({
  period: z.enum(LEADERBOARD_PERIODS).default('week'),
  /** Staff choose the batch; a learner always sees their own and this is ignored. */
  batchId: z.uuid().optional(),
  limit: z.coerce.number().int().min(3).max(100).default(50),
});
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;

export interface LeaderboardBreakdown {
  lessons: number;
  practice: number;
  assignments: number;
  tests: number;
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  /** First name and the initial of the last, e.g. "Diya D." */
  displayName: string;
  initials: string;
  points: number;
  breakdown: LeaderboardBreakdown;
  isYou: boolean;
}

export interface LeaderboardResponse {
  period: LeaderboardPeriod;
  /** Start of the period (a date key), or null for all time. */
  from: string | null;
  /** The batch the board covers; null when the learner is in no batch. */
  batch: { id: string; code: string; name: string } | null;
  /** Batches the caller may switch between (staff); a learner gets their own. */
  batches: { id: string; code: string; name: string }[];
  /** Learners in the batch, including those with no points yet. */
  total: number;
  entries: LeaderboardEntry[];
  /** The caller's own row when it falls outside `entries` (learners only). */
  you: LeaderboardEntry | null;
  /** Plain-language rules, shown beside the board. */
  rules: string[];
}
