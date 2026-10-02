import { DEFAULT_ASSIGNMENT_SETTINGS, type AssignmentSettings } from '@lms/shared';
import { describe, expect, it } from 'vitest';
import { revealAnswers } from './learner-assignments.service.js';
import type { LearnerState, PlacementState } from './learner-state.js';

const NOW = new Date('2026-10-05T10:00:00Z');
const YESTERDAY = new Date('2026-10-04T10:00:00Z');
const TOMORROW = new Date('2026-10-06T10:00:00Z');

const settings = (
  explanationPolicy: AssignmentSettings['explanationPolicy'],
): AssignmentSettings => ({
  ...DEFAULT_ASSIGNMENT_SETTINGS,
  explanationPolicy,
});
const placement = (overrides: Partial<PlacementState> = {}): PlacementState => ({
  progress: 'incorrect',
  attempts: 1,
  attemptsLeft: 2,
  awardedMarks: 0,
  lastSubmittedAt: YESTERDAY,
  unlocked: true,
  moduleId: 'm1',
  ...overrides,
});
const state = (dueAt: Date | null, closedReason: string | null = null) =>
  ({ dueAt, closedReason }) as LearnerState;

describe('when the answer key is shown to a learner (Phase 2, D7)', () => {
  it('never shows it when the assignment says never', () => {
    expect(
      revealAnswers(settings('never'), placement({ progress: 'correct' }), state(null), NOW),
    ).toBe(false);
  });

  it('shows it once the question is solved or out of attempts, unless still being run', () => {
    const policy = settings('after_solve');
    expect(revealAnswers(policy, placement(), state(null), NOW)).toBe(false);
    expect(revealAnswers(policy, placement({ progress: 'correct' }), state(null), NOW)).toBe(true);
    expect(revealAnswers(policy, placement({ attemptsLeft: 0 }), state(null), NOW)).toBe(true);
    expect(
      revealAnswers(
        policy,
        placement({ progress: 'evaluating', attemptsLeft: 0 }),
        state(null),
        NOW,
      ),
    ).toBe(false);
  });

  it('holds it back past the due date while a late answer can still be given', () => {
    const policy = settings('after_due');
    // Overdue, late answers accepted, attempts left: the key would turn the last try into copying.
    expect(revealAnswers(policy, placement(), state(YESTERDAY), NOW)).toBe(false);
    // Before the due date nothing is shown, even once the learner has finished.
    expect(revealAnswers(policy, placement({ progress: 'correct' }), state(TOMORROW), NOW)).toBe(
      false,
    );
  });

  it('shows it after the due date once the learner can answer no more', () => {
    const policy = settings('after_due');
    expect(revealAnswers(policy, placement({ attemptsLeft: 0 }), state(YESTERDAY), NOW)).toBe(true);
    expect(revealAnswers(policy, placement({ progress: 'correct' }), state(YESTERDAY), NOW)).toBe(
      true,
    );
    expect(revealAnswers(policy, placement(), state(YESTERDAY, 'Closed'), NOW)).toBe(true);
  });

  it('falls back to "once finished" when there is no due date at all', () => {
    const policy = settings('after_due');
    expect(revealAnswers(policy, placement(), state(null), NOW)).toBe(false);
    expect(revealAnswers(policy, placement({ attemptsLeft: 0 }), state(null), NOW)).toBe(true);
  });
});
