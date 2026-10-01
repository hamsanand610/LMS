import { DEFAULT_ASSIGNMENT_SETTINGS } from '@lms/shared';
import { describe, expect, it } from 'vitest';
import {
  effectivePublication,
  learnerState,
  type StateAssignment,
  type StatePublication,
  type StateSubmission,
} from './learner-state.js';

const NOW = new Date('2026-10-05T10:00:00Z');
const DAY = 86_400_000;

const placement = (id: string, position: number, marks = 10) => ({
  id,
  questionId: `q-${id}`,
  marks,
  position,
  question: { title: `Question ${id}`, type: 'coding', difficulty: 'easy' },
});

const assignment = (overrides: Partial<StateAssignment> = {}): StateAssignment => ({
  id: 'a1',
  title: 'Arrays',
  description: '',
  subject: 'java',
  difficulty: 'beginner',
  kind: 'coding',
  courseId: null,
  course: null,
  estimatedMinutes: 60,
  passPercent: 50,
  settings: { ...DEFAULT_ASSIGNMENT_SETTINGS },
  modules: [
    {
      id: 'm1',
      title: 'Basics',
      description: '',
      topic: 'arrays',
      position: 0,
      unlockRule: { type: 'always' },
      dueAfterDays: null,
      questions: [placement('p1', 0), placement('p2', 1)],
    },
    {
      id: 'm2',
      title: 'Harder',
      description: '',
      topic: 'strings',
      position: 1,
      unlockRule: { type: 'after_previous', minPercent: 100 },
      dueAfterDays: 7,
      questions: [placement('p3', 0)],
    },
  ],
  ...overrides,
});

const publication = (overrides: Partial<StatePublication> = {}): StatePublication => ({
  id: 'pub',
  batchId: 'b1',
  studentId: null,
  opensAt: null,
  dueAt: null,
  closesAt: null,
  publishedAt: new Date(NOW.getTime() - 2 * DAY),
  ...overrides,
});

let sequence = 0;
const submission = (
  placementId: string,
  attempt: number,
  status: string,
  marks = 0,
  reviewDecision: StateSubmission['reviewDecision'] = null,
): StateSubmission => ({
  id: `s${(sequence += 1)}`,
  assignmentQuestionId: placementId,
  attempt,
  status,
  marks,
  reviewDecision,
  submittedAt: new Date(NOW.getTime() - DAY + attempt * 1000),
});

describe('the learner state of an assignment', () => {
  it('starts not started, with the first question next and later modules locked', () => {
    const state = learnerState(assignment(), publication(), [], NOW);
    expect(state.row.status).toBe('not_started');
    expect(state.row.next?.placementId).toBe('p1');
    expect(state.modules[1]?.unlocked).toBe(false);
    expect(state.modules[1]?.lockReason).toMatch(/Finish the previous module/);
    // The second module is due seven days after the assignment reached the learner.
    expect(state.modules[1]?.dueAt).toBe(new Date(NOW.getTime() + 5 * DAY).toISOString());
    expect(state.row.dueAt).toBe(state.modules[1]?.dueAt);
  });

  it('opens the next module once the previous is solved, and moves on to it', () => {
    const state = learnerState(
      assignment(),
      publication(),
      [submission('p1', 1, 'correct', 10), submission('p2', 1, 'partial', 4)],
      NOW,
    );
    expect(state.modules[1]?.unlocked).toBe(true);
    expect(state.row.status).toBe('in_progress');
    // A partial answer can still be improved, so it is the next thing to open.
    expect(state.row.next?.placementId).toBe('p2');
    expect(state.row.awardedMarks).toBe(14);
  });

  it('counts the best attempt by default and the latest when the assignment says so', () => {
    const history = [submission('p1', 1, 'correct', 10), submission('p1', 2, 'incorrect', 0)];
    const best = learnerState(assignment(), publication(), history, NOW);
    expect(best.placements.get('p1')?.progress).toBe('correct');
    const latest = learnerState(
      assignment({ settings: { ...DEFAULT_ASSIGNMENT_SETTINGS, gradingMethod: 'latest' } }),
      publication(),
      history,
      NOW,
    );
    expect(latest.placements.get('p1')?.progress).toBe('incorrect');
    expect(latest.placements.get('p1')?.attemptsLeft).toBe(1);
  });

  it('does not charge an attempt for a sandbox failure, and gives one back on a resubmission request', () => {
    const state = learnerState(
      assignment(),
      publication(),
      [
        submission('p1', 1, 'error'),
        submission('p1', 2, 'incorrect'),
        submission('p1', 3, 'incorrect'),
        submission('p1', 4, 'partial', 5, 'resubmission_requested'),
      ],
      NOW,
    );
    const p1 = state.placements.get('p1')!;
    expect(p1.attempts).toBe(3);
    expect(p1.attemptsLeft).toBe(1);
    expect(p1.progress).toBe('resubmit');
  });

  it('is submitted while answers are being run, then passed or failed on the pass mark', () => {
    const answers = [
      submission('p1', 1, 'correct', 10),
      submission('p2', 1, 'correct', 10),
      submission('p3', 1, 'evaluating'),
    ];
    expect(learnerState(assignment(), publication(), answers, NOW).row.status).toBe('submitted');
    const marked = [...answers.slice(0, 2), submission('p3', 2, 'incorrect')];
    expect(learnerState(assignment(), publication(), marked, NOW).row.status).toBe('passed');
    const low = [
      submission('p1', 1, 'incorrect'),
      submission('p2', 1, 'partial', 3),
      submission('p3', 1, 'incorrect'),
    ];
    expect(learnerState(assignment(), publication(), low, NOW).row.status).toBe('failed');
  });

  it('is upcoming before it opens and closed with a reason after it closes', () => {
    const upcoming = learnerState(
      assignment(),
      publication({ opensAt: new Date(NOW.getTime() + DAY) }),
      [],
      NOW,
    );
    expect(upcoming.row.status).toBe('upcoming');
    expect(upcoming.row.next).toBeNull();
    const closed = learnerState(
      assignment(),
      publication({ closesAt: new Date(NOW.getTime() - 1) }),
      [submission('p1', 1, 'correct', 10)],
      NOW,
    );
    expect(closed.row.status).toBe('locked');
    expect(closed.closedReason).toBe('This assignment has closed');
  });
});

describe('which publication decides the dates', () => {
  it('prefers the learner’s own, then the batch one due first', () => {
    const batchLate = publication({ id: 'late', dueAt: new Date(NOW.getTime() + 9 * DAY) });
    const batchSoon = publication({ id: 'soon', dueAt: new Date(NOW.getTime() + 2 * DAY) });
    const undated = publication({ id: 'undated' });
    const personal = publication({ id: 'mine', batchId: null, studentId: 's1' });
    expect(effectivePublication([batchLate, undated, batchSoon])?.id).toBe('soon');
    expect(effectivePublication([batchLate, personal, batchSoon])?.id).toBe('mine');
    expect(effectivePublication([])).toBeNull();
  });
});
