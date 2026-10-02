import { describe, expect, it } from 'vitest';
import {
  countingSubmission,
  effectiveDueAt,
  effectivePublication,
  isClosed,
  learnerAssignmentStatus,
  moduleDueAt,
  questionProgress,
  type AssignmentFacts,
} from './assignment-status.js';

const NOW = Date.parse('2026-10-01T10:00:00Z');
const DAY = 86_400_000;

const facts = (overrides: Partial<AssignmentFacts> = {}): AssignmentFacts => ({
  now: NOW,
  opensAt: null,
  dueAt: null,
  closesAt: null,
  duePolicy: 'allow_late',
  questionCount: 4,
  answered: 0,
  evaluating: 0,
  awaitingReview: 0,
  fullMarks: 0,
  awardedMarks: 0,
  totalMarks: 40,
  passPercent: 40,
  ...overrides,
});

describe('learnerAssignmentStatus', () => {
  it('is upcoming before it opens, whatever else is true', () => {
    expect(learnerAssignmentStatus(facts({ opensAt: NOW + DAY }))).toBe('upcoming');
  });

  it('starts as not started and moves to in progress with the first answer', () => {
    expect(learnerAssignmentStatus(facts())).toBe('not_started');
    expect(learnerAssignmentStatus(facts({ answered: 1 }))).toBe('in_progress');
  });

  it('is overdue once the due date passes with work missing, while late work is accepted', () => {
    expect(learnerAssignmentStatus(facts({ dueAt: NOW - 1, answered: 2 }))).toBe('overdue');
    expect(learnerAssignmentStatus(facts({ dueAt: NOW - 1 }))).toBe('overdue');
  });

  it('locks when it closes with work missing, or at the due date when late work is refused', () => {
    expect(learnerAssignmentStatus(facts({ closesAt: NOW - 1, answered: 1 }))).toBe('locked');
    expect(
      learnerAssignmentStatus(facts({ dueAt: NOW - 1, duePolicy: 'block_late', answered: 1 })),
    ).toBe('locked');
  });

  it('waits as submitted while anything is being run or reviewed', () => {
    expect(learnerAssignmentStatus(facts({ answered: 4, evaluating: 1 }))).toBe('submitted');
    expect(learnerAssignmentStatus(facts({ answered: 4, awaitingReview: 2 }))).toBe('submitted');
  });

  it('passes, fails or completes against the pass mark once everything is marked', () => {
    expect(learnerAssignmentStatus(facts({ answered: 4, awardedMarks: 16 }))).toBe('passed');
    expect(learnerAssignmentStatus(facts({ answered: 4, awardedMarks: 15.5 }))).toBe('failed');
    expect(learnerAssignmentStatus(facts({ answered: 4, fullMarks: 4, awardedMarks: 40 }))).toBe(
      'completed',
    );
    // A finished outcome stands after the dates pass.
    expect(
      learnerAssignmentStatus(facts({ answered: 4, awardedMarks: 30, closesAt: NOW - 1 })),
    ).toBe('passed');
  });

  it('treats an empty assignment as not started rather than finished', () => {
    expect(learnerAssignmentStatus(facts({ questionCount: 0, totalMarks: 0 }))).toBe('not_started');
  });
});

describe('isClosed', () => {
  it('closes at the close date, and at the due date only when late work is refused', () => {
    expect(isClosed({ now: NOW, dueAt: NOW - 1, closesAt: null, duePolicy: 'allow_late' })).toBe(
      false,
    );
    expect(isClosed({ now: NOW, dueAt: NOW - 1, closesAt: null, duePolicy: 'block_late' })).toBe(
      true,
    );
    expect(isClosed({ now: NOW, dueAt: null, closesAt: NOW - 1, duePolicy: 'allow_late' })).toBe(
      true,
    );
  });
});

describe('question progress', () => {
  const sub = (attempt: number, status: string, marks = 0, reviewDecision = null as never) => ({
    attempt,
    status,
    marks,
    reviewDecision,
  });

  it('shows what is happening to the latest attempt first', () => {
    expect(questionProgress([], 'best')).toBe('not_attempted');
    expect(questionProgress([sub(1, 'correct', 5), sub(2, 'evaluating')], 'best')).toBe(
      'evaluating',
    );
    expect(questionProgress([sub(1, 'awaiting_grading')], 'best')).toBe('awaiting_review');
    expect(
      questionProgress([sub(1, 'partial', 2, 'resubmission_requested' as never)], 'best'),
    ).toBe('resubmit');
  });

  it('counts the best or the latest marked attempt, as the assignment says', () => {
    const history = [sub(1, 'correct', 5), sub(2, 'incorrect', 0)];
    expect(questionProgress(history, 'best')).toBe('correct');
    expect(questionProgress(history, 'latest')).toBe('incorrect');
    expect(countingSubmission(history, 'best')?.attempt).toBe(1);
  });

  it('reports a sandbox failure only when nothing else has been marked', () => {
    expect(questionProgress([sub(1, 'error')], 'best')).toBe('error');
    expect(questionProgress([sub(1, 'partial', 3), sub(2, 'error')], 'best')).toBe('partial');
  });
});

describe('which dates apply to a learner (Phase 2, LRN-06)', () => {
  const at = (offsetDays: number) => new Date(NOW + offsetDays * DAY);
  const publication = (
    overrides: Partial<{
      studentId: string | null;
      opensAt: Date | null;
      dueAt: Date | null;
      publishedAt: Date;
    }> = {},
  ) => ({ studentId: null, opensAt: null, dueAt: null, publishedAt: at(-10), ...overrides });

  it('takes the newest personal publication over any batch one', () => {
    const batch = publication({ dueAt: at(1) });
    const older = publication({ studentId: 's1', dueAt: at(9), publishedAt: at(-5) });
    const newer = publication({ studentId: 's1', dueAt: at(12), publishedAt: at(-2) });
    expect(effectivePublication([batch, older, newer])).toBe(newer);
  });

  it('otherwise takes the batch publication due first, and an undated one last', () => {
    const undated = publication({ publishedAt: at(-20) });
    const later = publication({ dueAt: at(8) });
    const sooner = publication({ dueAt: at(3), publishedAt: at(-1) });
    expect(effectivePublication([undated, later, sooner])).toBe(sooner);
    expect(effectivePublication([undated])).toBe(undated);
    expect(effectivePublication([])).toBeNull();
  });

  it('dates a module from when the publication opened, else from when it was published', () => {
    expect(moduleDueAt(publication({ opensAt: at(2) }), 3)).toEqual(at(5));
    expect(moduleDueAt(publication(), 3)).toEqual(at(-7));
    expect(moduleDueAt(publication(), null)).toBeNull();
  });

  it('uses the publication’s own due date, else the latest module’s', () => {
    const modules = [{ dueAfterDays: 2 }, { dueAfterDays: null }, { dueAfterDays: 14 }];
    expect(effectiveDueAt(publication({ dueAt: at(1) }), modules)).toEqual(at(1));
    expect(effectiveDueAt(publication({ opensAt: at(0) }), modules)).toEqual(at(14));
    expect(effectiveDueAt(publication(), [{ dueAfterDays: null }])).toBeNull();
    expect(effectiveDueAt(publication(), [])).toBeNull();
  });
});
