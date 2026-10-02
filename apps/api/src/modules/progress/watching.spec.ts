import { describe, expect, it } from 'vitest';
import {
  creditWatching,
  MAX_CREDIT_PER_REPORT_SECONDS,
  MAX_PLAYBACK_RATE,
  type WatchReport,
} from './watching.js';

const T0 = new Date('2026-10-02T09:00:00Z');
const later = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

const report = (overrides: Partial<WatchReport> = {}): WatchReport => ({
  watchedSeconds: 0,
  previousPosition: 0,
  previousReportAt: T0,
  position: 15,
  now: later(15),
  durationSeconds: 600,
  ...overrides,
});

/** Plays a video through the same reports a browser sends, and returns the credited seconds. */
function play(options: {
  durationSeconds: number;
  rate: number;
  everySeconds: number;
  wallSeconds: number;
}): number {
  let watched = 0;
  let position = 0;
  let previousReportAt: Date | null = null;
  let previousPosition = 0;
  for (let wall = 0; wall <= options.wallSeconds; wall += options.everySeconds) {
    position = Math.min(options.durationSeconds, wall * options.rate);
    watched = creditWatching({
      watchedSeconds: watched,
      previousPosition,
      previousReportAt,
      position,
      now: later(wall),
      durationSeconds: options.durationSeconds,
    });
    previousReportAt = later(wall);
    previousPosition = position;
  }
  return watched;
}

/** A small seeded generator, so the invariant checks below are repeatable. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

describe('watch time measured by the server (Phase 2, D2)', () => {
  it('credits what playback moved since the last report', () => {
    expect(creditWatching(report())).toBe(15);
    expect(creditWatching(report({ watchedSeconds: 100 }))).toBe(115);
  });

  it('takes the first report as the baseline only', () => {
    expect(creditWatching(report({ previousReportAt: null, position: 300 }))).toBe(0);
  });

  it('never credits a jump forward beyond twice the time that really passed', () => {
    expect(creditWatching(report({ position: 590, now: later(10) }))).toBe(10 * MAX_PLAYBACK_RATE);
  });

  it('never credits more than one report’s worth, however long the gap', () => {
    expect(creditWatching(report({ position: 500, now: later(3600) }))).toBe(
      MAX_CREDIT_PER_REPORT_SECONDS,
    );
  });

  it('credits nothing for seeking back, or when the clock runs backwards', () => {
    expect(
      creditWatching(report({ watchedSeconds: 40, previousPosition: 200, position: 30 })),
    ).toBe(40);
    expect(creditWatching(report({ watchedSeconds: 40, now: later(-30) }))).toBe(40);
  });

  it('never goes past the video’s length, and works without one', () => {
    expect(creditWatching(report({ watchedSeconds: 595, durationSeconds: 600 }))).toBe(600);
    expect(creditWatching(report({ watchedSeconds: 595, durationSeconds: 0 }))).toBe(610);
  });

  it('lets a learner who watches at normal or double speed reach the end', () => {
    expect(play({ durationSeconds: 600, rate: 1, everySeconds: 15, wallSeconds: 615 })).toBe(600);
    expect(play({ durationSeconds: 600, rate: 2, everySeconds: 15, wallSeconds: 315 })).toBe(600);
  });

  it('counts faster playback at no more than double speed', () => {
    // At four times speed the video ends after 150 s, but only 300 s of it can have been credited.
    expect(play({ durationSeconds: 600, rate: 4, everySeconds: 15, wallSeconds: 150 })).toBe(300);
  });

  it('holds its invariants for any sequence of reports', () => {
    const random = seeded(42);
    for (let run = 0; run < 2000; run += 1) {
      const durationSeconds = random() < 0.2 ? 0 : 30 + Math.floor(random() * 7200);
      const watchedSeconds = Math.floor(random() * (durationSeconds || 7200));
      const previousPosition = Math.floor(random() * 8000);
      const position = Math.floor(random() * 8000);
      const elapsed = Math.floor(random() * 400) - 20;
      const first = random() < 0.1;
      const credited = creditWatching({
        watchedSeconds,
        previousPosition,
        previousReportAt: first ? null : T0,
        position,
        now: later(elapsed),
        durationSeconds,
      });
      const ceiling = durationSeconds > 0 ? durationSeconds : Number.POSITIVE_INFINITY;
      // Never less than before (within the video's length), never more than the video.
      expect(credited).toBeGreaterThanOrEqual(Math.min(watchedSeconds, ceiling));
      expect(credited).toBeLessThanOrEqual(ceiling);
      // Never more than playback moved, twice the time that passed, or one report's worth.
      const gained = credited - watchedSeconds;
      expect(gained).toBeLessThanOrEqual(Math.max(0, position - previousPosition));
      expect(gained).toBeLessThanOrEqual(Math.max(0, elapsed) * MAX_PLAYBACK_RATE);
      expect(gained).toBeLessThanOrEqual(MAX_CREDIT_PER_REPORT_SECONDS);
      if (first) expect(gained).toBeLessThanOrEqual(0);
      expect(Number.isInteger(credited)).toBe(true);
    }
  });
});
