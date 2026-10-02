import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  SYSTEM_ROLES,
  type AttemptState,
  type QuestionSummary,
  type RunOutcome,
  type TestSummary,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

/**
 * TRN-12: inside a timed test, a coding answer runs on the question's visible cases, or on the
 * learner's own input, while the attempt is open. Hidden cases never run before submission, and
 * nobody but the attempt's learner can run anything on it.
 */
describe('running code inside a timed test', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let trainer: Session;
  let someoneElse: Session;
  let learner: Session;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);

  let batchId = '';
  let testId = '';
  let attemptId = '';
  let codingPlacement = '';
  let choicePlacement = '';
  let hiddenCaseId = '';
  const run = (session: Session, placement: string, body: Record<string, unknown>) =>
    session.post(`/attempts/${attemptId}/questions/${placement}/run`, body);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = new Session(app);
    trainer = new Session(app);
    someoneElse = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    expectStatus(await trainer.login(TEST_ACCOUNTS.trainer.email, password), 200);
    expectStatus(await someoneElse.login(TEST_ACCOUNTS.student.email, password), 200);

    // A batch and a learner of its own, so no other spec's learner sees this test.
    const organizationId = (await prisma.organization.findFirstOrThrow()).id;
    const assigned = await prisma.batch.findUniqueOrThrow({
      where: { code: TEST_FIXTURES.assignedBatchCode },
    });
    batchId = (
      await prisma.batch.create({
        data: {
          organizationId,
          programId: assigned.programId,
          code: `RUN-${unique}`,
          name: `Run batch ${unique}`,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'running',
        },
      })
    ).id;
    const role = await prisma.role.findFirstOrThrow({
      where: { organizationId, key: SYSTEM_ROLES.STUDENT },
    });
    const email = `test-run-${unique}@test.local`;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: 'Run Learner',
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
      },
    });
    const profile = await prisma.studentProfile.create({
      data: { userId: user.id, studentCode: `STU-RUN-${unique}`, status: 'active' },
    });
    await prisma.batchMember.create({ data: { batchId, studentId: profile.id } });
    learner = new Session(app);
    expectStatus(await learner.login(email, password), 200);

    const coding = expectStatus(
      await admin.post('/questions', {
        title: `Sum in a test ${unique}`,
        body: 'Print the sum of the integers on one line.',
        type: 'coding',
        subject: 'javascript',
        difficulty: 'foundation',
        marks: 4,
        coding: {
          languages: ['python'],
          starterCode: { python: '' },
          referenceSolution: { python: '# @sum' },
          inputFormat: 'One line of integers.',
          outputFormat: 'Their sum.',
          constraints: '',
          testCases: [
            { input: '1 2\n', expectedOutput: '3', isSample: true, label: 'Two numbers' },
            { input: '10 20 30\n', expectedOutput: '60', isSample: false },
          ],
        },
      }),
      201,
    ).body as QuestionSummary;
    expect(
      (
        expectStatus(await admin.post(`/questions/${coding.id}/validate`), 201).body as {
          ok: boolean;
        }
      ).ok,
    ).toBe(true);
    expectStatus(await admin.post(`/questions/${coding.id}/status`, { status: 'published' }), 201);
    hiddenCaseId = (
      await prisma.testCase.findFirstOrThrow({
        where: { problem: { questionId: coding.id }, isSample: false },
      })
    ).id;
    const choice = expectStatus(
      await admin.post('/questions', {
        title: `Choice in a test ${unique}`,
        body: 'Which keyword defines a function in Python?',
        type: 'mcq_single',
        subject: 'javascript',
        marks: 1,
        options: [
          { body: 'def', isCorrect: true },
          { body: 'fn', isCorrect: false },
        ],
      }),
      201,
    ).body as QuestionSummary;
    expectStatus(await admin.post(`/questions/${choice.id}/status`, { status: 'published' }), 201);

    testId = (
      expectStatus(
        await admin.post('/tests', {
          title: `Run test ${unique}`,
          kind: 'weekly',
          subject: 'javascript',
        }),
        201,
      ).body as TestSummary
    ).id;
    expectStatus(
      await admin.put(`/tests/${testId}/paper`, {
        sections: [
          {
            title: 'All',
            instructions: '',
            questions: [{ questionId: coding.id }, { questionId: choice.id }],
          },
        ],
      }),
      200,
    );
    expectStatus(await admin.post(`/tests/${testId}/status`, { status: 'published' }), 201);
    expectStatus(
      await admin.post(`/tests/${testId}/schedules`, {
        batchId,
        opensAt: new Date(Date.now() - 60_000).toISOString(),
        closesAt: new Date(Date.now() + 3_600_000).toISOString(),
      }),
      201,
    );
    const state = expectStatus(await learner.post(`/tests/${testId}/attempts`), 201)
      .body as AttemptState;
    attemptId = state.attemptId;
    codingPlacement = state.questions.find((q) => q.type === 'coding')!.testQuestionId;
    choicePlacement = state.questions.find((q) => q.type === 'mcq_single')!.testQuestionId;
  });

  afterAll(async () => {
    await prisma.testAttempt.deleteMany({ where: { testId } });
    await prisma.test.delete({ where: { id: testId } });
    await prisma.batchMember.updateMany({
      where: { batchId },
      data: { isActive: false, leftAt: new Date() },
    });
    await prisma.batch.update({ where: { id: batchId }, data: { deletedAt: new Date() } });
    await app.close();
  });

  it('runs the visible cases and the learner’s own input, never the hidden cases', async () => {
    const examples = expectStatus(
      await run(learner, codingPlacement, { language: 'python', code: '# @sum' }),
      200,
    ).body as RunOutcome;
    expect(examples.total).toBe(1);
    expect(examples.passed).toBe(1);
    expect(examples.cases).toHaveLength(1);

    const hidden = await run(learner, codingPlacement, {
      language: 'python',
      code: '# @sum',
      caseIds: [hiddenCaseId],
    });
    expect(hidden.status).toBe(422);
    expect(problemCode(hidden)).toBe('no_visible_cases');

    const own = expectStatus(
      await run(learner, codingPlacement, {
        language: 'python',
        code: '# @sum',
        customInput: '4 5\n',
      }),
      200,
    ).body as RunOutcome;
    expect(own.output?.stdout.trim()).toBe('9');

    // A run is a try, not an answer: nothing is saved or marked.
    const answer = await prisma.testAnswer.findFirstOrThrow({
      where: { attemptId, testQuestionId: codingPlacement },
    });
    expect(answer.code).toBe('');
    expect(answer.status).toBe('awaiting_grading');
  });

  it('is the attempt’s own learner’s, for its coding questions, while it is open', async () => {
    const body = { language: 'python', code: '# @sum' };
    expect((await run(someoneElse, codingPlacement, body)).status).toBe(403);
    expect((await run(trainer, codingPlacement, body)).status).toBe(403);

    const notCode = await run(learner, choicePlacement, body);
    expect(notCode.status).toBe(422);
    expect(problemCode(notCode)).toBe('not_runnable');

    expectStatus(await learner.post(`/attempts/${attemptId}/submit`, {}), 201);
    const closed = await run(learner, codingPlacement, body);
    expect(closed.status).toBe(422);
    expect(problemCode(closed)).toBe('attempt_not_open');
  });
});
