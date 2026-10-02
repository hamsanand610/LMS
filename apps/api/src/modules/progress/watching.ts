/**
 * Watch time measured by the server (Phase 2, D2). A video lesson's `watch` rule must not complete
 * on a percentage the browser asserts, so each progress report is credited only with what the
 * server can bound: how far playback moved since the last report, never more than the time that
 * really passed between the two reports, and never more than one report's worth.
 */

/** Faster playback still counts, up to twice real time. */
export const MAX_PLAYBACK_RATE = 2;

/** The most one report can earn: a playing video reports about every 15 seconds. */
export const MAX_CREDIT_PER_REPORT_SECONDS = 60;

export interface WatchReport {
  /** Seconds credited before this report. */
  watchedSeconds: number;
  /** The position of the previous report. */
  previousPosition: number;
  /** When the previous report arrived; null for the first one, which only sets the baseline. */
  previousReportAt: Date | null;
  /** The position this report gives. */
  position: number;
  now: Date;
  /** The lesson's length; 0 when it is not known. */
  durationSeconds: number;
}

/** Watched seconds after this report: never less than before, never more than the video's length. */
export function creditWatching(report: WatchReport): number {
  let credited = Math.max(0, report.watchedSeconds);
  if (report.previousReportAt) {
    const elapsed = Math.max(0, (report.now.getTime() - report.previousReportAt.getTime()) / 1000);
    const moved = report.position - report.previousPosition;
    if (moved > 0) {
      credited += Math.min(moved, elapsed * MAX_PLAYBACK_RATE, MAX_CREDIT_PER_REPORT_SECONDS);
    }
  }
  const capped = report.durationSeconds > 0 ? Math.min(credited, report.durationSeconds) : credited;
  return Math.floor(capped);
}
