import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type {
  AttemptResult,
  AttemptState,
  QuestionSummary,
  TestCard,
  TestDetail,
  TestGradingItem,
  TestMonitor,
  TestResultRow,
  TestScheduleRecord,
  TestSummary,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { AttemptsService } from '../src/modules/tests/index.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

/**
 * J-10 and J-11: a learner sits a timed test and, once the results are released, sees what they
 * scored. The deadline, the autosave and the release gate are what these assertions are about.
 */
describe('tests, attempts and results', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let student: Session;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);

  let testId = '';
  let scheduleId = '';
  let batchId = '';
  let attemptId = '';
  let mcqId = '';
  let writtenId = '';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = new Session(app);
    student = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    expectStatus(await student.login(TEST_ACCOUNTS.student.email, password), 200);
    batchId = (
      await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.assignedBatchCode } })
    ).id;

    mcqId = (
      expectStatus(
        await admin.post('/questions', {
          title: `Test MCQ ${unique}`,
          body: 'Which join keeps rows with no match on the right?',
          type: 'mcq_single',
          subject: 'sql',
          marks: 3,
          explanation: 'A LEFT JOIN keeps every row of the left table.',
          options: [
            { body: 'INNER JOIN', isCorrect: false },
            { body: 'LEFT JOIN', isCorrect: true },
            { body: 'CROSS JOIN', isCorrect: false },
          ],
        }),
        201,
      ).body as QuestionSummary
    ).id;
    expectStatus(await admin.post(`/questions/${mcqId}/status`, { status: 'published' }), 201);

    writtenId = (
      expectStatus(
        await admin.post('/questions', {
          title: `Test written ${unique}`,
          body: 'Explain what an index costs as well as what it saves.',
          type: 'descriptive',
          subject: 'sql',
          marks: 5,
          rubric: 'Full marks for the read benefit and the write cost.',
        }),
        201,
      ).body as QuestionSummary
    ).id;
    expectStatus(await admin.post(`/questions/${writtenId}/status`, { status: 'published' }), 201);
  });
  afterAll(async () => {
    await app.close();
  });

  it('builds a paper and refuses to schedule it while it is a draft', async () => {
    const created = expectStatus(
      await admin.post('/tests', {
        title: `Timed Test ${unique}`,
        kind: 'weekly',
        subject: 'sql',
        instructions: 'Answer both questions.',
        settings: {
          durationMinutes: 45,
          maxAttempts: 1,
          shuffleQuestions: false,
          shuffleOptions: false,
          resultPolicy: 'on_release',
          reviewPolicy: 'full',
          trackTabSwitches: true,
          requireFullScreen: false,
          showRank: true,
        },
      }),
      201,
    ).body as TestSummary;
    testId = created.id;

    const tooSoon = await admin.post(`/tests/${testId}/schedules`, {
      batchId,
      opensAt: new Date(Date.now() - 60_000).toISOString(),
      closesAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(tooSoon.status).toBe(422);
    expect(problemCode(tooSoon)).toBe('test_not_published');

    const paper = expectStatus(
      await admin.put(`/tests/${testId}/paper`, {
        sections: [
          {
            title: 'Objective',
            instructions: 'One mark scheme, no negative marking.',
            questions: [{ questionId: mcqId }],
          },
          { title: 'Written', instructions: '', questions: [{ questionId: writtenId }] },
        ],
      }),
      200,
    ).body as TestDetail;
    expect(paper.sections).toHaveLength(2);
    expect(paper.totalMarks).toBe(8);

    expectStatus(await admin.post(`/tests/${testId}/status`, { status: 'published' }), 201);
  });

  it('opens a window to a batch and tells the learners', async () => {
    const schedule = expectStatus(
      await admin.post(`/tests/${testId}/schedules`, {
        batchId,
        opensAt: new Date(Date.now() - 60_000).toISOString(),
        closesAt: new Date(Date.now() + 3 * 3_600_000).toISOString(),
      }),
      201,
    ).body as TestScheduleRecord;
    scheduleId = schedule.id;
    expect(schedule.batchCode).toBe(TEST_FIXTURES.assignedBatchCode);
    expect(schedule.learners).toBeGreaterThan(0);

    const card = (expectStatus(await student.get('/me/tests'), 200).body as TestCard[]).find(
      (t) => t.testId === testId,
    )!;
    expect(card.window).toBe('live');
    expect(card.canStart).toBe(true);
    expect(card.resultAvailable).toBe(false);
  });

  it('J-10: starts an attempt with a deadline the server owns (AC-07.1)', async () => {
    const state = expectStatus(await student.post(`/tests/${testId}/attempts`), 201)
      .body as AttemptState;
    attemptId = state.attemptId;
    expect(state.status).toBe('in_progress');
    expect(state.questions).toHaveLength(2);
    expect(state.secondsRemaining).toBeGreaterThan(0);
    expect(state.secondsRemaining).toBeLessThanOrEqual(45 * 60);

    const stored = await prisma.testAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(
      stored.expiresAt.getTime() - stored.startedAt.getTime(),
      'the deadline is written when the attempt starts, not worked out from the client',
    ).toBeLessThanOrEqual(45 * 60_000 + 1000);

    // The paper carries no answers and no mark scheme give-aways.
    const objective = state.questions.find((q) => q.type === 'mcq_single')!;
    expect(objective.options).toHaveLength(3);
    expect(JSON.stringify(objective)).not.toContain('isCorrect');
  });

  it('hands back the same attempt to a second tab rather than starting another (AC-07.4)', async () => {
    const again = expectStatus(await student.post(`/tests/${testId}/attempts`), 201)
      .body as AttemptState;
    expect(again.attemptId).toBe(attemptId);
    const count = await prisma.testAttempt.count({ where: { scheduleId } });
    expect(count).toBe(1);
  });

  it('restores every saved answer after a dropped connection (AC-07.2)', async () => {
    const state = expectStatus(await student.get(`/attempts/${attemptId}/state`), 200)
      .body as AttemptState;
    const objective = state.questions.find((q) => q.type === 'mcq_single')!;
    const written = state.questions.find((q) => q.type === 'descriptive')!;
    const chosen = objective.options.find((o) => o.body === 'LEFT JOIN')!;

    expectStatus(
      await student.patch(`/attempts/${attemptId}/answers`, {
        answers: [
          {
            testQuestionId: objective.testQuestionId,
            optionIds: [chosen.id],
            timeSpentSeconds: 40,
          },
          {
            testQuestionId: written.testQuestionId,
            text: 'An index speeds reads and costs writes, plus the space it occupies.',
            flagged: true,
            timeSpentSeconds: 90,
          },
        ],
      }),
      200,
    );

    // A fresh request stands in for the reload after the connection came back.
    const restored = expectStatus(await student.get(`/attempts/${attemptId}/state`), 200)
      .body as AttemptState;
    const restoredObjective = restored.questions.find(
      (q) => q.testQuestionId === objective.testQuestionId,
    )!;
    const restoredWritten = restored.questions.find(
      (q) => q.testQuestionId === written.testQuestionId,
    )!;
    expect(restoredObjective.optionIds).toEqual([chosen.id]);
    expect(restoredWritten.text).toContain('speeds reads');
    expect(restoredWritten.flagged).toBe(true);
    expect(restored.savedAt).not.toBeNull();
  });

  it('counts every tab switch without blocking anything', async () => {
    for (const expected of [1, 2]) {
      const response = expectStatus(
        await student.post(`/attempts/${attemptId}/events`, {
          type: 'tab_switch',
          occurredAt: new Date().toISOString(),
        }),
        201,
      ).body as { tabSwitches: number };
      expect(response.tabSwitches).toBe(expected);
    }
    const stored = await prisma.testAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(stored.integrityLog, 'the log keeps each event in order').toHaveLength(2);
  });

  it('shows the monitor what is happening while the test runs', async () => {
    const monitor = expectStatus(
      await admin.get(`/tests/${testId}/schedules/${scheduleId}/monitor`),
      200,
    ).body as TestMonitor;
    expect(monitor.inProgress).toBe(1);
    expect(monitor.submitted).toBe(0);
    expect(monitor.flagged[0]?.tabSwitches).toBe(2);
  });

  it('refuses to change the paper while somebody is sitting it', async () => {
    const response = await admin.put(`/tests/${testId}/paper`, { sections: [] });
    expect(response.status).toBe(422);
    expect(problemCode(response)).toBe('test_in_progress');
  });

  it('marks the objective answers on submission and queues the written one', async () => {
    const result = expectStatus(await student.post(`/attempts/${attemptId}/submit`, {}), 201)
      .body as AttemptResult;
    expect(result.status).toBe('submitted');
    expect(result.pendingGrading).toBe(1);
    // The learner cannot see the score yet: the results have not been released (AC-07.3).
    expect(result.released).toBe(false);
    expect(result.score).toBe(0);
    expect(result.questions).toHaveLength(0);

    const stored = await prisma.testAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(Number(stored.score), 'the objective mark is recorded straight away').toBe(3);
  });

  it('shows staff the score before it is released (AC-07.3)', async () => {
    const rows = expectStatus(
      await admin.get(`/tests/${testId}/schedules/${scheduleId}/results`),
      200,
    ).body as TestResultRow[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.score).toBe(3);
    expect(rows[0]!.pendingGrading).toBe(1);
  });

  it('keeps other learners’ marks and the answer key from a learner, whatever route they try', async () => {
    // The results table is for staff, even when the window is the learner's own batch's.
    const table = await student.get(`/tests/${testId}/schedules/${scheduleId}/results`);
    expect(table.status).toBe(403);
    expect(JSON.stringify(table.body)).not.toContain('STU-2026');

    // Somebody else's attempt in the same window: no score, no answers, no mark scheme.
    const classmate = await prisma.studentProfile.findFirstOrThrow({
      where: { user: { email: TEST_ACCOUNTS.lockout.email } },
    });
    const theirs = await prisma.testAttempt.create({
      data: {
        testId,
        scheduleId,
        studentId: classmate.id,
        status: 'submitted',
        submittedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        totalMarks: 8,
        score: 8,
      },
    });
    try {
      const response = await student.get(`/attempts/${theirs.id}/result`);
      expect(response.status).toBe(403);
      expect(JSON.stringify(response.body)).not.toContain('correctOptionIds');
    } finally {
      await prisma.testAttempt.delete({ where: { id: theirs.id } });
    }

    // The staff-only routes stay closed too.
    expect((await student.get(`/tests/${testId}/schedules/${scheduleId}/monitor`)).status).toBe(
      403,
    );
    expect((await student.get(`/tests/${testId}/grading/queue`)).status).toBe(403);
  });

  it('shows a trainer the windows of the batches they teach, and no others', async () => {
    const trainer = new Session(app);
    expectStatus(await trainer.login(TEST_ACCOUNTS.trainer.email, password), 200);
    const other = await prisma.batch.findUniqueOrThrow({
      where: { code: TEST_FIXTURES.otherBatchCode },
    });
    const foreign = expectStatus(
      await admin.post(`/tests/${testId}/schedules`, {
        batchId: other.id,
        opensAt: new Date(Date.now() - 60_000).toISOString(),
        closesAt: new Date(Date.now() + 3_600_000).toISOString(),
      }),
      201,
    ).body as TestScheduleRecord;
    try {
      expectStatus(await trainer.get(`/tests/${testId}/schedules/${scheduleId}/results`), 200);
      for (const path of ['results', 'monitor']) {
        const response = await trainer.get(`/tests/${testId}/schedules/${foreign.id}/${path}`);
        expect(response.status, path).toBe(403);
      }
      const release = await trainer.post(`/tests/${testId}/schedules/${foreign.id}/release`);
      expect(release.status).toBe(403);
      const windows = expectStatus(await trainer.get(`/tests/${testId}/schedules`), 200)
        .body as TestScheduleRecord[];
      expect(windows.map((w) => w.id)).toEqual([scheduleId]);
    } finally {
      expectStatus(await admin.delete(`/tests/${testId}/schedules/${foreign.id}`), 200);
    }
  });

  it('refuses to release while a written answer is unmarked', async () => {
    const response = await admin.post(`/tests/${testId}/schedules/${scheduleId}/release`);
    expect(response.status).toBe(422);
    expect(problemCode(response)).toBe('grading_incomplete');
  });

  it('J-11: marks the written answer, releases, and the learner sees the result', async () => {
    const queue = expectStatus(await admin.get(`/tests/${testId}/grading/queue`), 200)
      .body as TestGradingItem[];
    expect(queue).toHaveLength(1);
    expect(queue[0]!.rubric).toContain('write cost');

    const graded = expectStatus(
      await admin.patch(`/attempts/${attemptId}/answers/${queue[0]!.answerId}/grade`, {
        marks: 4,
        comment: 'Good on both halves.',
      }),
      200,
    ).body as { attemptScore: number };
    expect(graded.attemptScore).toBe(7);

    const release = expectStatus(
      await admin.post(`/tests/${testId}/schedules/${scheduleId}/release`),
      201,
    ).body as { notified: number };
    expect(release.notified).toBe(1);

    const result = expectStatus(await student.get(`/attempts/${attemptId}/result`), 200)
      .body as AttemptResult;
    expect(result.released).toBe(true);
    expect(result.score).toBe(7);
    expect(result.totalMarks).toBe(8);
    expect(result.percentage).toBe(88);
    expect(result.rank).toBe(1);
    expect(result.questions).toHaveLength(2);
    const objective = result.questions.find((q) => q.type === 'mcq_single')!;
    expect(objective.correctOptionIds).toHaveLength(1);
    expect(objective.explanation).toContain('LEFT JOIN');
    const written = result.questions.find((q) => q.type === 'descriptive')!;
    expect(written.graderComment).toBe('Good on both halves.');
  });

  it('refuses a second release', async () => {
    const response = await admin.post(`/tests/${testId}/schedules/${scheduleId}/release`);
    expect(response.status).toBe(409);
    expect(problemCode(response)).toBe('already_released');
  });

  it('shows the released score on the learner list and the progress page', async () => {
    const card = (expectStatus(await student.get('/me/tests'), 200).body as TestCard[]).find(
      (t) => t.testId === testId,
    )!;
    expect(card.resultAvailable).toBe(true);
    expect(card.score).toBe(7);

    const overview = expectStatus(await student.get('/me/progress'), 200).body as {
      assessment: { tests: { taken: number; averagePercentage: number; history: unknown[] } };
    };
    expect(overview.assessment.tests.taken).toBeGreaterThan(0);
    expect(overview.assessment.tests.averagePercentage).toBeGreaterThan(0);
  });

  it('submits an attempt whose time has run out, whatever the client does (AC-07.1)', async () => {
    // A second window, so a fresh attempt can be made and then expired.
    const other = await prisma.batch.findUniqueOrThrow({
      where: { code: TEST_FIXTURES.otherBatchCode },
    });
    const secondTest = expectStatus(
      await admin.post('/tests', {
        title: `Expiring Test ${unique}`,
        kind: 'practice',
        settings: {
          durationMinutes: 1,
          maxAttempts: 1,
          shuffleQuestions: false,
          shuffleOptions: false,
          resultPolicy: 'immediately',
          reviewPolicy: 'full',
          trackTabSwitches: false,
          requireFullScreen: false,
          showRank: false,
        },
      }),
      201,
    ).body as TestSummary;
    expectStatus(
      await admin.put(`/tests/${secondTest.id}/paper`, {
        sections: [{ title: 'Only section', questions: [{ questionId: mcqId }] }],
      }),
      200,
    );
    expectStatus(await admin.post(`/tests/${secondTest.id}/status`, { status: 'published' }), 201);
    expectStatus(
      await admin.post(`/tests/${secondTest.id}/schedules`, {
        batchId,
        opensAt: new Date(Date.now() - 60_000).toISOString(),
        closesAt: new Date(Date.now() + 3_600_000).toISOString(),
      }),
      201,
    );
    expect(other.id).toBeTruthy();

    const state = expectStatus(await student.post(`/tests/${secondTest.id}/attempts`), 201)
      .body as AttemptState;
    // Wind the deadline back rather than waiting a minute for it.
    await prisma.testAttempt.update({
      where: { id: state.attemptId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const attempts = app.get(AttemptsService);
    expect(await attempts.submitExpired()).toBeGreaterThan(0);

    const after = await prisma.testAttempt.findUniqueOrThrow({ where: { id: state.attemptId } });
    expect(after.status).not.toBe('in_progress');
    expect(after.autoSubmitted).toBe(true);

    // A late save is refused rather than silently accepted.
    const late = await student.patch(`/attempts/${state.attemptId}/answers`, { answers: [] });
    expect(late.status).toBe(422);
    expect(problemCode(late)).toBe('attempt_not_open');
  });
});
