import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type {
  AssignmentDetail,
  AssignmentProgressCard,
  AssignmentProgressRow,
  AssignmentPublicationRecord,
  AssignmentSummary,
  GradingQueueItem,
  Paginated,
  ProgressOverview,
  QuestionDetail,
  QuestionImportResult,
  QuestionSummary,
  StudentDashboard,
  SubmissionResult,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { BrowserSandboxDriver } from '../src/modules/execution/index.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

/**
 * J-06 and J-09: an author builds an assignment from the bank, publishes it to a batch, and the
 * learner works through it — objective answers marked at once, a written answer queued for a
 * person, and the module gate opening only when the rule is met.
 */
describe('question bank, assignments and grading', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let trainer: Session;
  let student: Session;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);

  let mcqId = '';
  let writtenId = '';
  let assignmentId = '';
  let batchId = '';
  let firstPlacementId = '';
  let secondModulePlacementId = '';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = new Session(app);
    trainer = new Session(app);
    student = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    expectStatus(await trainer.login(TEST_ACCOUNTS.trainer.email, password), 200);
    expectStatus(await student.login(TEST_ACCOUNTS.student.email, password), 200);
    batchId = (
      await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.assignedBatchCode } })
    ).id;
  });
  afterAll(async () => {
    await app.close();
  });

  // ───────────────────────── the question bank ─────────────────────────

  it('refuses a multiple-choice question with no correct option', async () => {
    const response = await admin.post('/questions', {
      title: `Broken ${unique}`,
      body: 'Which of these is right?',
      type: 'mcq_single',
      options: [
        { body: 'One', isCorrect: false },
        { body: 'Two', isCorrect: false },
      ],
    });
    expect(response.status).toBe(400);
    expect(problemCode(response)).toBe('validation_failed');
  });

  it('writes a multiple-choice question and publishes it', async () => {
    const created = expectStatus(
      await admin.post('/questions', {
        title: `Which keyword freezes a binding? ${unique}`,
        body: 'Choose the declaration that refuses reassignment.',
        type: 'mcq_single',
        subject: 'javascript',
        difficulty: 'easy',
        marks: 2,
        explanation: 'const refuses reassignment.',
        options: [
          { body: 'var', isCorrect: false },
          { body: 'let', isCorrect: false },
          { body: 'const', isCorrect: true },
        ],
      }),
      201,
    ).body as QuestionSummary;
    mcqId = created.id;
    expect(created.status).toBe('draft');

    const published = expectStatus(
      await admin.post(`/questions/${mcqId}/status`, { status: 'published' }),
      201,
    ).body as QuestionSummary;
    expect(published.status).toBe('published');
    expect(published.version).toBe(1);
  });

  it('writes a question that a person has to mark', async () => {
    const created = expectStatus(
      await admin.post('/questions', {
        title: `Explain the event loop ${unique}`,
        body: 'Describe the call stack, the queue and when callbacks run.',
        type: 'descriptive',
        subject: 'javascript',
        marks: 5,
        rubric: 'Full marks for the stack, the queue and the ordering.',
      }),
      201,
    ).body as QuestionSummary;
    writtenId = created.id;
    expectStatus(await admin.post(`/questions/${writtenId}/status`, { status: 'published' }), 201);
  });

  it('hides the answer from a learner and shows it to an author', async () => {
    const asAuthor = expectStatus(await admin.get(`/questions/${mcqId}`), 200)
      .body as QuestionDetail;
    expect(asAuthor.options.some((o) => o.isCorrect === true)).toBe(true);
    expect(asAuthor.explanation).not.toBe('');

    // A learner never reaches this endpoint; the workspace serves a stripped copy instead.
    expect((await student.get(`/questions/${mcqId}`)).status).toBe(403);
  });

  it('keeps a version each time a question changes', async () => {
    expectStatus(
      await admin.put(`/questions/${mcqId}`, {
        title: `Which keyword freezes a binding? ${unique}`,
        body: 'Choose the declaration that refuses reassignment. Edited.',
        type: 'mcq_single',
        subject: 'javascript',
        marks: 2,
        explanation: 'const refuses reassignment.',
        options: [
          { body: 'var', isCorrect: false },
          { body: 'let', isCorrect: false },
          { body: 'const', isCorrect: true },
        ],
      }),
      200,
    );
    const versions = expectStatus(await admin.get(`/questions/${mcqId}/versions`), 200).body as {
      version: number;
    }[];
    expect(versions.length).toBeGreaterThanOrEqual(2);
  });

  it('refuses to change the type of a saved question', async () => {
    const response = await admin.put(`/questions/${mcqId}`, {
      title: `Which keyword freezes a binding? ${unique}`,
      body: 'Edited again.',
      type: 'true_false',
      options: [
        { body: 'True', isCorrect: true },
        { body: 'False', isCorrect: false },
      ],
    });
    expect(response.status).toBe(422);
    expect(problemCode(response)).toBe('question_type_locked');
  });

  it('imports a sheet and reports every bad row with its line (AC-06.1)', async () => {
    const sheet = [
      'title,body,type,subject,difficulty,marks,option_1,option_2,option_3,option_4,correct',
      `Import good one ${unique},Pick the right answer,mcq_single,sql,easy,1,A,B,C,D,2`,
      `Import good two ${unique},Is this true?,true_false,sql,easy,1,,,,,true`,
      `Import bad type ${unique},Pick one,essay,sql,easy,1,A,B,,,1`,
      `,Missing title,mcq_single,sql,easy,1,A,B,,,1`,
      `Import bad correct ${unique},Pick one,mcq_single,sql,easy,1,A,B,,,9`,
    ].join('\n');

    const dry = expectStatus(
      await admin.post('/questions/import', { content: sheet, dryRun: true }),
      201,
    ).body as QuestionImportResult;
    expect(dry.total).toBe(5);
    expect(dry.imported).toBe(0);
    expect(dry.failed).toBe(3);
    expect(dry.errors.map((e) => e.row).sort()).toEqual([4, 5, 6]);
    expect(dry.errors.find((e) => e.row === 6)?.message).toMatch(/no option 9/i);

    const real = expectStatus(
      await admin.post('/questions/import', { content: sheet, dryRun: false, publish: true }),
      201,
    ).body as QuestionImportResult;
    expect(real.imported).toBe(2);

    // Running the same sheet again skips what is already there rather than duplicating it.
    const again = expectStatus(
      await admin.post('/questions/import', { content: sheet, dryRun: false }),
      201,
    ).body as QuestionImportResult;
    expect(again.imported).toBe(0);
    expect(again.skipped).toBe(2);
  });

  it('keeps a trainer to the questions they wrote', async () => {
    const own = expectStatus(
      await trainer.post('/questions', {
        title: `Trainer question ${unique}`,
        body: 'Written by the trainer.',
        type: 'true_false',
        options: [
          { body: 'True', isCorrect: true },
          { body: 'False', isCorrect: false },
        ],
      }),
      201,
    ).body as QuestionSummary;

    const list = expectStatus(await trainer.get('/questions?pageSize=100'), 200)
      .body as Paginated<QuestionSummary>;
    expect(list.data.every((q) => q.authorId !== null)).toBe(true);
    expect(list.data.map((q) => q.id)).toContain(own.id);
    expect(list.data.map((q) => q.id)).not.toContain(mcqId);
    expect((await trainer.put(`/questions/${mcqId}`, { title: 'x' })).status).toBe(400);
  });

  // ───────────────────────── the assignment ─────────────────────────

  it('J-06: builds an assignment from the bank and publishes it to a batch', async () => {
    const created = expectStatus(
      await admin.post('/assignments', {
        title: `Test Assignment ${unique}`,
        description: 'Built by the API tests.',
        subject: 'javascript',
        settings: {
          attemptsPerQuestion: 2,
          explanationPolicy: 'after_solve',
          duePolicy: 'allow_late',
        },
      }),
      201,
    ).body as AssignmentSummary;
    assignmentId = created.id;

    const structured = expectStatus(
      await admin.put(`/assignments/${assignmentId}/structure`, {
        modules: [
          {
            title: 'Module one',
            unlockRule: { type: 'always' },
            questions: [{ questionId: mcqId }],
          },
          {
            title: 'Module two',
            unlockRule: { type: 'after_previous', minPercent: 60 },
            questions: [{ questionId: writtenId }],
          },
        ],
      }),
      200,
    ).body as AssignmentDetail;
    expect(structured.modules).toHaveLength(2);
    expect(structured.totalMarks).toBe(7);
    firstPlacementId = structured.modules[0]!.questions[0]!.id;
    secondModulePlacementId = structured.modules[1]!.questions[0]!.id;

    const publication = expectStatus(
      await admin.post(`/assignments/${assignmentId}/publish`, { batchId }),
      201,
    ).body as AssignmentPublicationRecord;
    expect(publication.batchCode).toBe(TEST_FIXTURES.assignedBatchCode);
    expect(publication.learners).toBeGreaterThan(0);
  });

  it('refuses to publish the same assignment to one batch twice', async () => {
    const response = await admin.post(`/assignments/${assignmentId}/publish`, { batchId });
    expect(response.status).toBe(409);
    expect(problemCode(response)).toBe('already_published');
  });

  it('refuses a question that is not published', async () => {
    const draft = expectStatus(
      await admin.post('/questions', {
        title: `Draft only ${unique}`,
        body: 'Still a draft.',
        type: 'true_false',
        options: [
          { body: 'True', isCorrect: true },
          { body: 'False', isCorrect: false },
        ],
      }),
      201,
    ).body as QuestionSummary;
    const response = await admin.put(`/assignments/${assignmentId}/structure`, {
      modules: [
        { title: 'Nope', unlockRule: { type: 'always' }, questions: [{ questionId: draft.id }] },
      ],
    });
    expect(response.status).toBe(400);
  });

  it('shows the learner the assignment with the second module locked (AC-06.2)', async () => {
    const mine = expectStatus(await student.get('/me/assignments'), 200)
      .body as AssignmentProgressCard[];
    expect(mine.map((a) => a.assignmentId)).toContain(assignmentId);

    const detail = expectStatus(await student.get(`/assignments/${assignmentId}/me`), 200)
      .body as AssignmentDetail;
    expect(detail.modules[0]!.unlocked).toBe(true);
    expect(detail.modules[1]!.unlocked).toBe(false);
    expect(detail.modules[1]!.lockReason).toMatch(/60%/);

    const blocked = await student.get(
      `/assignments/${assignmentId}/questions/${secondModulePlacementId}`,
    );
    expect(blocked.status).toBe(403);
    expect(problemCode(blocked)).toBe('module_locked');
  });

  it('does not leak the answer to the workspace', async () => {
    const response = expectStatus(
      await student.get(`/assignments/${assignmentId}/questions/${firstPlacementId}`),
      200,
    ).body as { question: QuestionDetail };
    expect(response.question.options.every((o) => o.isCorrect === undefined)).toBe(true);
    expect(response.question.explanation).toBe('');
  });

  it('J-09: marks a multiple-choice answer at once and opens the next module (AC-06.3)', async () => {
    const question = expectStatus(
      await student.get(`/assignments/${assignmentId}/questions/${firstPlacementId}`),
      200,
    ).body as { question: QuestionDetail };
    const wrong = question.question.options[0]!.id;

    const missed = expectStatus(
      await student.post(`/assignments/${assignmentId}/questions/${firstPlacementId}/submissions`, {
        optionIds: [wrong],
      }),
      201,
    ).body as SubmissionResult;
    expect(missed.status).toBe('incorrect');
    expect(missed.marks).toBe(0);
    expect(missed.attempts).toBe(1);
    expect(missed.attemptsLeft).toBe(1);
    expect(missed.explanation, 'the answer stays hidden until they get it right').toBeUndefined();

    const correctOption = question.question.options.find((o) => o.body === 'const')!;
    const right = expectStatus(
      await student.post(`/assignments/${assignmentId}/questions/${firstPlacementId}/submissions`, {
        optionIds: [correctOption.id],
      }),
      201,
    ).body as SubmissionResult;
    expect(right.status).toBe('correct');
    expect(right.marks).toBe(2);
    expect(right.explanation).toContain('const');

    const detail = expectStatus(await student.get(`/assignments/${assignmentId}/me`), 200)
      .body as AssignmentDetail;
    expect(detail.modules[1]!.unlocked, 'module one is fully solved, so module two opens').toBe(
      true,
    );
    expect(detail.progressPct).toBe(50);
  });

  it('refuses a third attempt when the assignment allows two', async () => {
    const response = await student.post(
      `/assignments/${assignmentId}/questions/${firstPlacementId}/submissions`,
      { optionIds: [] },
    );
    expect(response.status).toBe(422);
    expect(problemCode(response)).toBe('attempts_exhausted');
  });

  it('queues a written answer for a person, and marks it when they grade it', async () => {
    const submitted = expectStatus(
      await student.post(
        `/assignments/${assignmentId}/questions/${secondModulePlacementId}/submissions`,
        { text: 'The call stack runs one thing at a time; queued callbacks wait for it to empty.' },
      ),
      201,
    ).body as SubmissionResult;
    expect(submitted.status).toBe('awaiting_grading');
    expect(submitted.marks).toBe(0);

    const queue = expectStatus(await admin.get('/assignments/grading/queue'), 200)
      .body as GradingQueueItem[];
    const mine = queue.find((item) => item.submissionId === submitted.id)!;
    expect(mine.rubric).toContain('Full marks');
    expect(mine.answer).toContain('call stack');

    const graded = expectStatus(
      await admin.post(`/submissions/${submitted.id}/grade`, { marks: 4, comment: 'Well put.' }),
      201,
    ).body as SubmissionResult;
    expect(graded.status).toBe('partial');
    expect(graded.marks).toBe(4);

    const afterGrading = expectStatus(await admin.get('/assignments/grading/queue'), 200)
      .body as GradingQueueItem[];
    expect(afterGrading.map((i) => i.submissionId)).not.toContain(submitted.id);
  });

  it('refuses more marks than the question is worth', async () => {
    const queue = expectStatus(await admin.get('/assignments/grading/queue'), 200)
      .body as GradingQueueItem[];
    if (queue.length === 0) return;
    const response = await admin.post(`/submissions/${queue[0]!.submissionId}/grade`, {
      marks: 99,
    });
    expect(response.status).toBe(422);
    expect(problemCode(response)).toBe('marks_above_maximum');
  });

  it('reports the same figures to the learner and to staff (AC-06.4)', async () => {
    const detail = expectStatus(await student.get(`/assignments/${assignmentId}/me`), 200)
      .body as AssignmentDetail;
    expect(detail.solved).toBe(2);
    expect(detail.awardedMarks).toBe(6);
    expect(detail.progressPct).toBe(100);

    const rows = expectStatus(await admin.get(`/assignments/${assignmentId}/progress`), 200)
      .body as AssignmentProgressRow[];
    const mine = rows.find((row) => row.studentCode.startsWith('STU'))!;
    expect(mine.solved).toBe(detail.solved);
    expect(mine.awardedMarks).toBe(detail.awardedMarks);
    expect(mine.totalMarks).toBe(detail.totalMarks);

    const overview = expectStatus(await student.get('/me/progress'), 200).body as ProgressOverview;
    expect(overview.assessment.assignments.solved).toBe(detail.solved);
    expect(overview.assessment.assignments.awardedMarks).toBe(detail.awardedMarks);
    expect(
      overview.pending.map((p) => p.key),
      'assignments and tests are measured now; only attendance is still pending',
    ).toEqual(['attendance']);

    const dashboard = expectStatus(await student.get('/me/dashboard'), 200)
      .body as StudentDashboard;
    expect(dashboard.tasks.every((task) => task.id !== assignmentId)).toBe(true);
  });

  it('keeps a trainer out of a batch they do not teach', async () => {
    const otherBatch = await prisma.batch.findUniqueOrThrow({
      where: { code: TEST_FIXTURES.otherBatchCode },
    });
    const response = await trainer.post(`/assignments/${assignmentId}/publish`, {
      batchId: otherBatch.id,
    });
    expect([403, 404]).toContain(response.status);
  });

  it('never runs learner code on the server (ADR-0007)', async () => {
    const driver = app.get(BrowserSandboxDriver);
    expect(driver.runsOnServer).toBe(false);
    expect(driver.trust).toBe('untrusted');
    await expect(
      driver.run({
        language: 'javascript',
        code: 'process.exit(1)',
        cases: [],
        timeLimitMs: 1000,
        memoryLimitMb: 64,
      }),
    ).rejects.toThrow(/never runs code on the server/);
  });
});
