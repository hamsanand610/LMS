import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type {
  AssignmentAnalytics,
  AssignmentDetail,
  AssignmentProgressRow,
  AssignmentPublicationRecord,
  AssignmentSummary,
  LearnerAssignmentDetail,
  LearnerAssignmentList,
  LearnerQuestionWorkspace,
  Paginated,
  ProgressOverview,
  QuestionDetail,
  QuestionImportResult,
  QuestionSummary,
  ReviewQueueItem,
  RunOutcome,
  SubmissionHistoryItem,
  SubmissionView,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import {
  EXECUTION_DRIVER,
  ExecutionUnavailableError,
  NoExecutionDriver,
} from '../src/modules/execution/index.js';
import { createTestApp } from './setup/app.js';
import type { FakeExecutionDriver } from './setup/fake-execution.driver.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

const DAY = 86_400_000;
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * J-06 and J-09 with Task 4's assignments: an author builds an assignment from the bank and gives
 * it to a batch; the learner works through it — objective answers marked at once, code run in the
 * sandbox against hidden cases, a written answer reviewed by a person — and every figure agrees
 * between the learner's pages and the staff views. The sandbox is the test stand-in
 * (setup/fake-execution.driver.ts); the real one has its own suite in apps/runner.
 */
describe('question bank, assignments and review', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let trainer: Session;
  let student: Session;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);

  let mcqId = '';
  let writtenId = '';
  let codingId = '';
  let sqlId = '';
  let assignmentId = '';
  let personalId = '';
  let batchId = '';
  let otherBatchId = '';
  let studentId = '';
  let mcqPlacement = '';
  let codingPlacement = '';
  let writtenPlacement = '';
  let sqlPlacement = '';
  let writtenSubmissionId = '';

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
    otherBatchId = (
      await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.otherBatchCode } })
    ).id;
    studentId = (
      await prisma.studentProfile.findFirstOrThrow({
        where: { user: { email: TEST_ACCOUNTS.student.email } },
      })
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

  it('keeps a version each time a question changes, and keeps the option ids', async () => {
    const before = expectStatus(await admin.get(`/questions/${mcqId}`), 200).body as QuestionDetail;
    const [optionVar, optionLet, optionConst] = before.options;
    expectStatus(
      await admin.put(`/questions/${mcqId}`, {
        title: `Which keyword freezes a binding? ${unique}`,
        body: 'Choose the declaration that refuses reassignment. Edited.',
        type: 'mcq_single',
        subject: 'javascript',
        marks: 2,
        explanation: 'const refuses reassignment.',
        // Reworded, reordered, one dropped and one added: the kept options keep their ids.
        options: [
          { id: optionConst!.id, body: 'const (block scoped)', isCorrect: true },
          { id: optionLet!.id, body: 'let', isCorrect: false },
          { body: 'function', isCorrect: false },
        ],
      }),
      200,
    );
    const after = expectStatus(await admin.get(`/questions/${mcqId}`), 200).body as QuestionDetail;
    expect(after.options.map((o) => o.body)).toEqual(['const (block scoped)', 'let', 'function']);
    expect(after.options[0]!.id).toBe(optionConst!.id);
    expect(after.options[1]!.id).toBe(optionLet!.id);
    expect(after.options.map((o) => o.id)).not.toContain(optionVar!.id);

    // Back to the original three, so the answers later in this file read as written.
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
          { id: optionLet!.id, body: 'let', isCorrect: false },
          { id: optionConst!.id, body: 'const', isCorrect: true },
        ],
      }),
      200,
    );
    const versions = expectStatus(await admin.get(`/questions/${mcqId}/versions`), 200).body as {
      version: number;
    }[];
    expect(versions.length).toBeGreaterThanOrEqual(3);
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
    // A complete, valid edit, so that it is the ownership rule that refuses it (not validation).
    const takeover = await trainer.put(`/questions/${mcqId}`, {
      title: `Taken over ${unique}`,
      body: 'Not theirs to change.',
      type: 'mcq_single',
      subject: 'javascript',
      difficulty: 'easy',
      marks: 2,
      options: [
        { body: 'var', isCorrect: true },
        { body: 'const', isCorrect: false },
      ],
    });
    expect(takeover.status).toBe(403);
    expect((await trainer.post(`/questions/${mcqId}/status`, { status: 'draft' })).status).toBe(
      403,
    );
    expect((await trainer.get(`/questions/${mcqId}`)).status).toBe(403);
  });

  // ───────────────────────── coding and SQL questions ─────────────────────────

  it('writes a coding question whose hidden cases only staff can see, and checks it before publishing', async () => {
    const created = expectStatus(
      await admin.post('/questions', {
        title: `Sum the numbers ${unique}`,
        body: 'Read integers from one line and print their sum.',
        type: 'coding',
        subject: 'javascript',
        difficulty: 'foundation',
        marks: 4,
        hints: ['Split the line on spaces.'],
        coding: {
          languages: ['java', 'python'],
          starterCode: { java: 'public class Main {}', python: '' },
          referenceSolution: { java: '// @sum', python: '# @sum' },
          inputFormat: 'One line of integers.',
          outputFormat: 'Their sum.',
          constraints: 'Up to 100 numbers.',
          testCases: [
            { input: '1 2\n', expectedOutput: '3', isSample: true, label: 'Two numbers' },
            { input: '10 20 30\n', expectedOutput: '60', isSample: false, weight: 2 },
            { input: '-5 5\n', expectedOutput: '0', isSample: false },
          ],
        },
      }),
      201,
    ).body as QuestionSummary;
    codingId = created.id;

    // Not checked yet: it cannot be published.
    const early = await admin.post(`/questions/${codingId}/status`, { status: 'published' });
    expect(problemCode(early)).toBe('question_not_validated');

    const validation = expectStatus(await admin.post(`/questions/${codingId}/validate`), 201)
      .body as {
      ok: boolean;
    };
    expect(validation.ok).toBe(true);
    expectStatus(await admin.post(`/questions/${codingId}/status`, { status: 'published' }), 201);

    // The author sees every case, so the editor can show and save the hidden ones.
    const detail = expectStatus(await admin.get(`/questions/${codingId}`), 200)
      .body as QuestionDetail;
    expect(detail.coding?.testCases.map((c) => c.input)).toEqual(['1 2\n', '10 20 30\n', '-5 5\n']);
  });

  it('tells the author why a reference solution fails its check', async () => {
    const created = expectStatus(
      await admin.post('/questions', {
        title: `A check that fails ${unique}`,
        body: 'Read two integers and print their sum.',
        type: 'coding',
        subject: 'javascript',
        difficulty: 'foundation',
        marks: 1,
        coding: {
          languages: ['java', 'python'],
          referenceSolution: { java: '// @wrong', python: '# @timeout' },
          testCases: [
            { input: '1 2\n', expectedOutput: '3', isSample: true },
            { input: '2 2\n', expectedOutput: '4', isSample: false },
          ],
        },
      }),
      201,
    ).body as QuestionSummary;
    const validation = expectStatus(await admin.post(`/questions/${created.id}/validate`), 201)
      .body as { ok: boolean; languages: { language: string; message: string }[] };
    const message = (language: string) =>
      validation.languages.find((l) => l.language === language)?.message;
    expect(validation.ok).toBe(false);
    expect(message('java')).toBe('2 cases failed: wrong answer');
    // Only out of time: it may have met a busy sandbox, and the author is told to try again.
    expect(message('python')).toBe(
      '2 cases failed: time limit exceeded. If the solution is right, run the check again',
    );
  });

  it('keeps test case ids when a question is edited, so recorded results still point at them', async () => {
    const before = expectStatus(await admin.get(`/questions/${codingId}`), 200)
      .body as QuestionDetail;
    const cases = before.coding!.testCases;
    expectStatus(
      await admin.put(`/questions/${codingId}`, {
        title: `Sum the numbers ${unique}`,
        body: 'Read integers from one line and print their sum.',
        type: 'coding',
        subject: 'javascript',
        difficulty: 'foundation',
        marks: 4,
        coding: {
          languages: ['java', 'python'],
          referenceSolution: { java: '// @sum', python: '# @sum' },
          testCases: [
            { ...cases[0], id: cases[0]!.id },
            { ...cases[1], id: cases[1]!.id },
            { ...cases[2], id: cases[2]!.id },
          ].map(({ id, input, expectedOutput, isSample, weight, label }) => ({
            id,
            input,
            expectedOutput,
            isSample,
            weight,
            label,
          })),
        },
      }),
      200,
    );
    const after = expectStatus(await admin.get(`/questions/${codingId}`), 200)
      .body as QuestionDetail;
    expect(after.coding!.testCases.map((c) => c.id)).toEqual(cases.map((c) => c.id));
    // An edit needs a fresh check before the question is trusted again.
    expect(after.validation).toBeNull();
    expectStatus(await admin.post(`/questions/${codingId}/validate`), 201);
  });

  it('writes an SQL question whose expected tables come from the reference query', async () => {
    const table = '{"columns":["name"],"rows":[["Bhavana"],["Divya"]]}';
    const created = expectStatus(
      await admin.post('/questions', {
        title: `Learners who passed ${unique}`,
        body: 'List the names of learners who scored 60 or more, alphabetically.',
        type: 'sql',
        subject: 'sql',
        difficulty: 'easy',
        marks: 3,
        coding: {
          languages: ['sql'],
          compareMode: 'rows',
          setupSql:
            "CREATE TABLE learner (name TEXT, score INTEGER); INSERT INTO learner VALUES ('Arun', 58), ('Bhavana', 64);",
          referenceSolution: {
            sql: `SELECT name FROM learner WHERE score >= 60 ORDER BY name; -- result: ${table}`,
          },
          testCases: [
            { input: '', expectedOutput: '', isSample: true },
            {
              input: "INSERT INTO learner VALUES ('Divya', 71);",
              expectedOutput: '',
              isSample: false,
            },
          ],
        },
      }),
      201,
    ).body as QuestionSummary;
    sqlId = created.id;
    expect(
      (expectStatus(await admin.post(`/questions/${sqlId}/validate`), 201).body as { ok: boolean })
        .ok,
    ).toBe(true);
    const detail = expectStatus(await admin.get(`/questions/${sqlId}`), 200).body as QuestionDetail;
    expect(detail.coding?.testCases.every((c) => c.expectedOutput === table)).toBe(true);
    expectStatus(await admin.post(`/questions/${sqlId}/status`, { status: 'published' }), 201);
  });

  // ───────────────────────── the assignment ─────────────────────────

  it('refuses a technology that is not one of the institute’s terms', async () => {
    const response = await admin.post('/assignments', { title: `Bad ${unique}`, subject: 'cobol' });
    expect(response.status).toBe(400);
  });

  it('J-06: builds an assignment from the bank and gives it to a batch, with dates', async () => {
    const created = expectStatus(
      await admin.post('/assignments', {
        title: `Test Assignment ${unique}`,
        description: 'Built by the API tests.',
        instructions: 'Answer every question. Coding answers are run against hidden cases.',
        subject: 'javascript',
        difficulty: 'beginner',
        kind: 'mixed',
        estimatedMinutes: 90,
        passPercent: 50,
        settings: {
          attemptsPerQuestion: 2,
          explanationPolicy: 'after_solve',
          duePolicy: 'allow_late',
          gradingMethod: 'best',
        },
      }),
      201,
    ).body as AssignmentSummary;
    assignmentId = created.id;
    expect(created.kind).toBe('mixed');

    const structured = expectStatus(
      await admin.put(`/assignments/${assignmentId}/structure`, {
        modules: [
          {
            title: 'Module one',
            topic: 'arrays',
            unlockRule: { type: 'always' },
            questions: [{ questionId: mcqId }, { questionId: codingId }],
          },
          {
            title: 'Module two',
            topic: 'queries',
            dueAfterDays: 3,
            unlockRule: { type: 'after_previous', minPercent: 100 },
            questions: [{ questionId: writtenId }, { questionId: sqlId }],
          },
        ],
      }),
      200,
    ).body as AssignmentDetail;
    expect(structured.modules).toHaveLength(2);
    expect(structured.totalMarks).toBe(14);
    mcqPlacement = structured.modules[0]!.questions[0]!.id;
    codingPlacement = structured.modules[0]!.questions[1]!.id;
    writtenPlacement = structured.modules[1]!.questions[0]!.id;
    sqlPlacement = structured.modules[1]!.questions[1]!.id;

    const [publication] = expectStatus(
      await admin.post(`/assignments/${assignmentId}/publish`, {
        batchId,
        opensAt: new Date(Date.now() - 60_000).toISOString(),
        dueAt: new Date(Date.now() + 5 * DAY).toISOString(),
      }),
      201,
    ).body as AssignmentPublicationRecord[];
    expect(publication?.audience).toBe('batch');
    expect(publication?.batchCode).toBe(TEST_FIXTURES.assignedBatchCode);
    expect(publication?.learners).toBeGreaterThan(0);
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

  // ───────────────────────── the learner ─────────────────────────

  it('lists the assignment for the learner with a computed status, summary and filters', async () => {
    const list = expectStatus(await student.get('/me/assignments'), 200)
      .body as LearnerAssignmentList;
    const row = list.data.find((r) => r.id === assignmentId)!;
    expect(row.status).toBe('not_started');
    expect(row.questionCount).toBe(4);
    expect(row.next?.placementId).toBe(mcqPlacement);
    expect(list.summary.total).toBeGreaterThan(0);
    expect(
      list.facets.technologies.some((f) => f.key === 'javascript' && f.label === 'JavaScript'),
    ).toBe(true);

    const found = expectStatus(
      await student.get(`/me/assignments?q=${unique}&status=not_started`),
      200,
    ).body as LearnerAssignmentList;
    expect(found.data.map((r) => r.id)).toContain(assignmentId);
    const excluded = expectStatus(await student.get('/me/assignments?kind=coding'), 200)
      .body as LearnerAssignmentList;
    expect(excluded.data.map((r) => r.id)).not.toContain(assignmentId);
    const paged = expectStatus(await student.get('/me/assignments?pageSize=1&sort=title'), 200)
      .body as LearnerAssignmentList;
    expect(paged.data.length).toBeLessThanOrEqual(1);
    expect(paged.meta.total).toBe(list.meta.total);
  });

  it('shows the set with the second module locked (AC-06.2)', async () => {
    const detail = expectStatus(await student.get(`/me/assignments/${assignmentId}`), 200)
      .body as LearnerAssignmentDetail;
    expect(detail.instructions).toContain('hidden cases');
    expect(detail.modules[0]?.unlocked).toBe(true);
    expect(detail.modules[1]?.unlocked).toBe(false);
    expect(detail.modules[1]?.lockReason).toMatch(/Finish the previous module/);
    expect(detail.modules[1]?.dueAt).not.toBeNull();

    const locked = await student.get(
      `/me/assignments/${assignmentId}/questions/${writtenPlacement}`,
    );
    expect(locked.status).toBe(403);
    expect(problemCode(locked)).toBe('module_locked');
  });

  it('does not leak the answer or a hidden case to the workspace', async () => {
    const mcq = expectStatus(
      await student.get(`/me/assignments/${assignmentId}/questions/${mcqPlacement}`),
      200,
    ).body as LearnerQuestionWorkspace;
    expect(mcq.question.options).toHaveLength(3);
    expect(JSON.stringify(mcq)).not.toContain('isCorrect');
    expect(mcq.progress.canSubmit).toBe(true);

    const coding = expectStatus(
      await student.get(`/me/assignments/${assignmentId}/questions/${codingPlacement}`),
      200,
    ).body as LearnerQuestionWorkspace;
    expect(coding.question.coding?.samples).toHaveLength(1);
    expect(coding.question.coding?.hiddenCount).toBe(2);
    const text = JSON.stringify(coding);
    expect(text).not.toContain('10 20 30');
    expect(text).not.toContain('referenceSolution');
    expect(text).not.toContain('@sum');
  });

  it('J-09: marks a multiple-choice answer at once, and reveals the answer only once it is solved', async () => {
    const workspace = expectStatus(
      await student.get(`/me/assignments/${assignmentId}/questions/${mcqPlacement}`),
      200,
    ).body as LearnerQuestionWorkspace;
    const wrong = workspace.question.options.find((o) => o.body === 'var')!;
    const right = workspace.question.options.find((o) => o.body === 'const')!;

    const first = expectStatus(
      await student.post(`/me/assignments/${assignmentId}/questions/${mcqPlacement}/submissions`, {
        optionIds: [wrong.id],
      }),
      201,
    ).body as SubmissionView;
    expect(first.status).toBe('incorrect');
    expect(first.correctOptionIds).toBeNull();
    expect(first.explanation).toBeNull();

    const second = expectStatus(
      await student.post(`/me/assignments/${assignmentId}/questions/${mcqPlacement}/submissions`, {
        optionIds: [right.id],
      }),
      201,
    ).body as SubmissionView;
    expect(second.status).toBe('correct');
    expect(second.marks).toBe(2);
    expect(second.correctOptionIds).toEqual([right.id]);
    expect(second.explanation).toContain('const');

    const third = await student.post(
      `/me/assignments/${assignmentId}/questions/${mcqPlacement}/submissions`,
      {
        optionIds: [right.id],
      },
    );
    expect(third.status).toBe(422);
    expect(problemCode(third)).toBe('attempts_exhausted');
  });

  it('runs code on the visible cases only, and on the learner’s own input', async () => {
    const driver = app.get(EXECUTION_DRIVER) as FakeExecutionDriver;
    const before = driver.jobs.length;
    const run = expectStatus(
      await student.post(`/me/assignments/${assignmentId}/questions/${codingPlacement}/run`, {
        language: 'java',
        code: '// @sum',
      }),
      200,
    ).body as RunOutcome;
    expect(run.verdict).toBe('passed');
    expect(run.cases).toHaveLength(1);
    expect(run.cases[0]?.expectedOutput).toBe('3');
    // The sandbox was given the visible case and nothing else.
    const job = driver.jobs[before]!;
    expect(job.cases.map((c) => c.stdin)).toEqual(['1 2\n']);
    expect(JSON.stringify(job)).not.toContain('expected');

    const custom = expectStatus(
      await student.post(`/me/assignments/${assignmentId}/questions/${codingPlacement}/run`, {
        language: 'python',
        code: '# @sum',
        customInput: '40 2',
      }),
      200,
    ).body as RunOutcome;
    expect(custom.output?.stdout.trim()).toBe('42');

    const wrongLanguage = await student.post(
      `/me/assignments/${assignmentId}/questions/${codingPlacement}/run`,
      {
        language: 'php',
        code: '<?php',
      },
    );
    expect(problemCode(wrongLanguage)).toBe('language_not_offered');
  });

  it('evaluates a submission against every case and shows hidden ones only as verdicts', async () => {
    const wrong = expectStatus(
      await student.post(
        `/me/assignments/${assignmentId}/questions/${codingPlacement}/submissions`,
        {
          language: 'java',
          code: '// @wrong',
          idempotencyKey: `key-${unique}-1`,
        },
      ),
      201,
    ).body as SubmissionView;
    expect(wrong.status).toBe('incorrect');
    expect(wrong.verdict).toBe('wrong_answer');
    expect(wrong.cases).toHaveLength(3);
    const hidden = wrong.cases.filter((c) => c.hidden);
    expect(hidden).toHaveLength(2);
    expect(hidden.every((c) => c.input === undefined && c.expectedOutput === undefined)).toBe(true);
    expect(wrong.cases.find((c) => !c.hidden)?.expectedOutput).toBe('3');

    // A retry with the same key returns the first submission instead of making another.
    const retried = expectStatus(
      await student.post(
        `/me/assignments/${assignmentId}/questions/${codingPlacement}/submissions`,
        {
          language: 'java',
          code: '// @sum',
          idempotencyKey: `key-${unique}-1`,
        },
      ),
      201,
    ).body as SubmissionView;
    expect(retried.id).toBe(wrong.id);
    const reused = await student.post(
      `/me/assignments/${assignmentId}/questions/${sqlPlacement}/submissions`,
      {
        language: 'sql',
        code: 'SELECT 1',
        idempotencyKey: `key-${unique}-1`,
      },
    );
    expect(problemCode(reused)).toBe('idempotency_key_reused');

    const right = expectStatus(
      await student.post(
        `/me/assignments/${assignmentId}/questions/${codingPlacement}/submissions`,
        {
          language: 'java',
          code: '// @sum',
        },
      ),
      201,
    ).body as SubmissionView;
    expect(right.status).toBe('correct');
    expect(right.marks).toBe(4);
    expect(right.passed).toBe(3);

    // The recorded attempt never changes: the first one is still wrong, with its own code.
    const stored = await prisma.submission.findUniqueOrThrow({ where: { id: wrong.id } });
    expect(stored.code).toBe('// @wrong');
    expect(stored.status).toBe('incorrect');

    const history = expectStatus(
      await student.get(`/me/assignments/${assignmentId}/questions/${codingPlacement}/submissions`),
      200,
    ).body as SubmissionHistoryItem[];
    expect(history.map((h) => h.attempt)).toEqual([2, 1]);
    expect(history[0]?.verdict).toBe('passed');
  });

  it('shows staff the whole answer, hidden cases included', async () => {
    const [latest] = await prisma.submission.findMany({
      where: { assignmentQuestionId: codingPlacement },
      orderBy: { attempt: 'desc' },
      take: 1,
    });
    const view = expectStatus(await admin.get(`/submissions/${latest!.id}`), 200)
      .body as SubmissionView;
    expect(view.cases.every((c) => c.input !== undefined)).toBe(true);
    expect(view.student?.code).toBe('STU-2026-9001');
  });

  it('opens the next module and takes a written answer and an SQL answer', async () => {
    const detail = expectStatus(await student.get(`/me/assignments/${assignmentId}`), 200)
      .body as LearnerAssignmentDetail;
    expect(detail.modules[1]?.unlocked).toBe(true);

    const written = expectStatus(
      await student.post(
        `/me/assignments/${assignmentId}/questions/${writtenPlacement}/submissions`,
        {
          text: 'The stack runs synchronous code; queued callbacks run when it is empty.',
        },
      ),
      201,
    ).body as SubmissionView;
    expect(written.status).toBe('awaiting_review');
    writtenSubmissionId = written.id;

    const table = '{"columns":["name"],"rows":[["Bhavana"],["Divya"]]}';
    const wrongSql = expectStatus(
      await student.post(`/me/assignments/${assignmentId}/questions/${sqlPlacement}/submissions`, {
        language: 'sql',
        code: 'SELECT name FROM learner; -- result: {"columns":["name"],"rows":[["Arun"]]}',
      }),
      201,
    ).body as SubmissionView;
    expect(wrongSql.status).toBe('incorrect');
    const rightSql = expectStatus(
      await student.post(`/me/assignments/${assignmentId}/questions/${sqlPlacement}/submissions`, {
        language: 'sql',
        code: `SELECT name FROM learner WHERE score >= 60 ORDER BY name; -- result: ${table}`,
      }),
      201,
    ).body as SubmissionView;
    expect(rightSql.status).toBe('correct');

    // Everything answered and one answer waiting for a person: submitted.
    const list = expectStatus(await student.get('/me/assignments'), 200)
      .body as LearnerAssignmentList;
    expect(list.data.find((r) => r.id === assignmentId)?.status).toBe('submitted');
  });

  it('lets a trainer mark a written answer in their batch, adding a review rather than rewriting', async () => {
    const queue = expectStatus(await trainer.get(`/submissions?assignmentId=${assignmentId}`), 200)
      .body as Paginated<ReviewQueueItem>;
    expect(queue.data.map((i) => i.submissionId)).toContain(writtenSubmissionId);

    const tooMany = await trainer.post(`/submissions/${writtenSubmissionId}/reviews`, {
      decision: 'graded',
      marks: 99,
    });
    expect(problemCode(tooMany)).toBe('marks_above_maximum');

    const reviewed = expectStatus(
      await trainer.post(`/submissions/${writtenSubmissionId}/reviews`, {
        decision: 'graded',
        marks: 4,
        comment: 'Good; say when microtasks run.',
      }),
      201,
    ).body as SubmissionView;
    expect(reviewed.status).toBe('partial');
    expect(reviewed.reviews).toHaveLength(1);
    expect(reviewed.text).toContain('synchronous code');
    // The reviewer marks against the scheme and sees every attempt at the question.
    expect(reviewed.reviewContext?.rubric).toContain('Full marks for the stack');
    expect(reviewed.reviewContext?.attempts.map((a) => a.id)).toContain(writtenSubmissionId);

    const mine = expectStatus(await student.get(`/me/submissions/${writtenSubmissionId}`), 200)
      .body as SubmissionView;
    expect(mine.reviews[0]?.comment).toContain('microtasks');
    expect(mine.marks).toBe(4);
    // The mark scheme never reaches the learner.
    expect(mine.reviewContext).toBeNull();
    expect(JSON.stringify(mine)).not.toContain('Full marks for the stack');

    const list = expectStatus(await student.get('/me/assignments'), 200)
      .body as LearnerAssignmentList;
    const row = list.data.find((r) => r.id === assignmentId)!;
    expect(row.status).toBe('passed');
    expect(row.awardedMarks).toBe(13);
  });

  it('reports the same figures to the learner and to staff (AC-06.4)', async () => {
    const detail = expectStatus(await student.get(`/me/assignments/${assignmentId}`), 200)
      .body as LearnerAssignmentDetail;
    const rows = expectStatus(await admin.get(`/assignments/${assignmentId}/progress`), 200)
      .body as AssignmentProgressRow[];
    const mine = rows.find((row) => row.studentCode === 'STU-2026-9001')!;
    expect(mine.status).toBe(detail.status);
    expect(mine.solved).toBe(detail.solved);
    expect(mine.awardedMarks).toBe(detail.awardedMarks);
    expect(mine.totalMarks).toBe(detail.totalMarks);
    expect(mine.attempts).toBe(7);
    expect(mine.failedAttempts).toBe(3);

    const overview = expectStatus(await student.get('/me/progress'), 200).body as ProgressOverview;
    expect(overview.assessment.assignments.awardedMarks).toBe(detail.awardedMarks);

    const trainerView = expectStatus(
      await trainer.get(`/assignments/${assignmentId}/progress?batchId=${otherBatchId}`),
      200,
    ).body as AssignmentProgressRow[];
    expect(trainerView).toHaveLength(0);
  });

  it('sends an answer back for another attempt, keeping the first decision on record', async () => {
    const noComment = await trainer.post(`/submissions/${writtenSubmissionId}/reviews`, {
      decision: 'resubmission_requested',
    });
    expect(noComment.status).toBe(400);
    expectStatus(
      await trainer.post(`/submissions/${writtenSubmissionId}/reviews`, {
        decision: 'resubmission_requested',
        comment: 'Add the microtask queue.',
      }),
      201,
    );
    const workspace = expectStatus(
      await student.get(`/me/assignments/${assignmentId}/questions/${writtenPlacement}`),
      200,
    ).body as LearnerQuestionWorkspace;
    expect(workspace.progress.status).toBe('resubmit');
    expect(workspace.progress.canSubmit).toBe(true);
    const reviews = await prisma.submissionReview.count({
      where: { submissionId: writtenSubmissionId },
    });
    expect(reviews).toBe(2);
  });

  it('refuses to take out a question that already has answers', async () => {
    const response = await admin.put(`/assignments/${assignmentId}/structure`, {
      modules: [
        {
          title: 'Only the first',
          unlockRule: { type: 'always' },
          questions: [{ questionId: mcqId }],
        },
      ],
    });
    expect(response.status).toBe(422);
    expect(problemCode(response)).toBe('placement_has_answers');
  });

  it('adds up the overview for administrators', async () => {
    const analytics = expectStatus(await admin.get('/assignments/analytics'), 200)
      .body as AssignmentAnalytics;
    expect(analytics.totals.assignments).toBeGreaterThan(0);
    expect(analytics.learners.reached).toBeGreaterThan(0);
    expect(analytics.submissions.total).toBeGreaterThanOrEqual(7);
    expect(analytics.byTopic.length).toBeGreaterThan(0);
    expect((await student.get('/assignments/analytics')).status).toBe(403);
  });

  // ───────────────────────── other audiences and dates ─────────────────────────

  it('gives an assignment to one learner, and a closed one cannot be answered', async () => {
    const created = expectStatus(
      await admin.post('/assignments', {
        title: `Personal Assignment ${unique}`,
        subject: 'javascript',
        settings: {
          attemptsPerQuestion: 1,
          explanationPolicy: 'never',
          duePolicy: 'block_late',
          gradingMethod: 'best',
        },
      }),
      201,
    ).body as AssignmentSummary;
    personalId = created.id;
    const structure = expectStatus(
      await admin.put(`/assignments/${personalId}/structure`, {
        modules: [
          { title: 'One', unlockRule: { type: 'always' }, questions: [{ questionId: mcqId }] },
        ],
      }),
      200,
    ).body as AssignmentDetail;
    const [publication] = expectStatus(
      await admin.post(`/assignments/${personalId}/publish`, {
        studentIds: [studentId],
        opensAt: new Date(Date.now() - 2 * DAY).toISOString(),
        dueAt: new Date(Date.now() - DAY).toISOString(),
      }),
      201,
    ).body as AssignmentPublicationRecord[];
    expect(publication?.audience).toBe('learner');
    expect(publication?.studentCode).toBe('STU-2026-9001');

    const list = expectStatus(await student.get('/me/assignments'), 200)
      .body as LearnerAssignmentList;
    expect(list.data.find((r) => r.id === personalId)?.status).toBe('locked');
    const refused = await student.post(
      `/me/assignments/${personalId}/questions/${structure.modules[0]!.questions[0]!.id}/submissions`,
      { optionIds: [] },
    );
    expect(refused.status).toBe(422);
    expect(problemCode(refused)).toBe('assignment_closed');
  });

  it('lists an assignment that has not opened as upcoming, and keeps its questions shut', async () => {
    const created = expectStatus(
      await admin.post('/assignments', {
        title: `Upcoming Assignment ${unique}`,
        subject: 'javascript',
      }),
      201,
    ).body as AssignmentSummary;
    const structure = expectStatus(
      await admin.put(`/assignments/${created.id}/structure`, {
        modules: [
          { title: 'One', unlockRule: { type: 'always' }, questions: [{ questionId: mcqId }] },
        ],
      }),
      200,
    ).body as AssignmentDetail;
    expectStatus(
      await admin.post(`/assignments/${created.id}/publish`, {
        batchId,
        opensAt: new Date(Date.now() + 2 * DAY).toISOString(),
      }),
      201,
    );
    const list = expectStatus(await student.get('/me/assignments?status=upcoming'), 200)
      .body as LearnerAssignmentList;
    expect(list.data.map((r) => r.id)).toContain(created.id);
    const shut = await student.get(
      `/me/assignments/${created.id}/questions/${structure.modules[0]!.questions[0]!.id}`,
    );
    expect(shut.status).toBe(403);
    expect(problemCode(shut)).toBe('assignment_not_open');
  });

  it('takes a project answer with its link and checklist, and waits for a person', async () => {
    const question = expectStatus(
      await admin.post('/questions', {
        title: `Build a landing page ${unique}`,
        body: 'Build and deploy a responsive landing page.',
        type: 'project',
        subject: 'html-css',
        marks: 10,
        rubric: 'Layout, responsiveness, accessibility.',
        spec: {
          linkRequired: true,
          linkLabel: 'repository link',
          checklist: ['It works on a phone'],
        },
      }),
      201,
    ).body as QuestionSummary;
    expectStatus(
      await admin.post(`/questions/${question.id}/status`, { status: 'published' }),
      201,
    );
    const created = expectStatus(
      await admin.post('/assignments', {
        title: `Project ${unique}`,
        subject: 'html-css',
        kind: 'project',
      }),
      201,
    ).body as AssignmentSummary;
    const structure = expectStatus(
      await admin.put(`/assignments/${created.id}/structure`, {
        modules: [
          {
            title: 'Build',
            unlockRule: { type: 'always' },
            questions: [{ questionId: question.id }],
          },
        ],
      }),
      200,
    ).body as AssignmentDetail;
    expectStatus(await admin.post(`/assignments/${created.id}/publish`, { batchId }), 201);
    const path = `/me/assignments/${created.id}/questions/${structure.modules[0]!.questions[0]!.id}/submissions`;

    expect((await student.post(path, { checklist: [0] })).status).toBe(400);
    expect((await student.post(path, { links: ['https://git.example.test/landing'] })).status).toBe(
      400,
    );
    expect(
      (await student.post(path, { links: ['javascript:alert(1)'], checklist: [0] })).status,
    ).toBe(400);
    const handed = expectStatus(
      await student.post(path, { links: ['https://git.example.test/landing'], checklist: [0] }),
      201,
    ).body as SubmissionView;
    expect(handed.status).toBe('awaiting_review');
    expect(handed.links).toEqual(['https://git.example.test/landing']);
  });

  it('marks an answer as not checked when the sandbox is down, without charging an attempt', async () => {
    const created = expectStatus(
      await admin.post('/assignments', {
        title: `Outage ${unique}`,
        subject: 'javascript',
        settings: {
          attemptsPerQuestion: 1,
          explanationPolicy: 'never',
          duePolicy: 'allow_late',
          gradingMethod: 'best',
        },
      }),
      201,
    ).body as AssignmentSummary;
    const structure = expectStatus(
      await admin.put(`/assignments/${created.id}/structure`, {
        modules: [
          { title: 'One', unlockRule: { type: 'always' }, questions: [{ questionId: codingId }] },
        ],
      }),
      200,
    ).body as AssignmentDetail;
    expectStatus(await admin.post(`/assignments/${created.id}/publish`, { batchId }), 201);
    const placement = structure.modules[0]!.questions[0]!.id;
    const path = `/me/assignments/${created.id}/questions/${placement}/submissions`;

    const lost = expectStatus(
      await student.post(path, { language: 'java', code: '// @unavailable' }),
      201,
    ).body as SubmissionView;
    expect(lost.status).toBe('error');
    expect(lost.evaluationError).toMatch(/could not be checked/);

    // Staff can send it back to the sandbox; it is still down, so it is still not checked.
    const again = expectStatus(await trainer.post(`/submissions/${lost.id}/re-evaluate`), 201)
      .body as SubmissionView;
    expect(again.status).toBe('error');

    // The one allowed attempt is still there.
    const fixed = expectStatus(await student.post(path, { language: 'java', code: '// @sum' }), 201)
      .body as SubmissionView;
    expect(fixed.status).toBe('correct');
  });

  it('judges practice in the sandbox, and a browser’s old claim no longer counts as solved', async () => {
    expectStatus(
      await admin.post(`/questions/${codingId}/practice`, { inCatalogue: true, points: 15 }),
      201,
    );
    const slug = (await prisma.question.findUniqueOrThrow({ where: { id: codingId } })).slug;

    const detail = expectStatus(await student.get(`/practice/problems/${slug}`), 200).body as {
      samples: unknown[];
      hiddenTestCount: number;
      status: string;
    };
    expect(detail.samples).toHaveLength(1);
    expect(detail.hiddenTestCount).toBe(2);
    expect(JSON.stringify(detail)).not.toContain('10 20 30');

    // Before ADR-0016 a browser could post "passed"; such a row stays untrusted and counts for nothing.
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: TEST_ACCOUNTS.student.email },
    });
    await prisma.executionRun.create({
      data: {
        questionId: codingId,
        userId: user.id,
        context: 'practice',
        language: 'javascript',
        code: 'claimed',
        driver: 'browser-sandbox',
        trust: 'untrusted',
        verdict: 'passed',
        passedCount: 1,
        totalCount: 1,
      },
    });
    const claimed = expectStatus(await student.get(`/practice/problems/${slug}`), 200).body as {
      status: string;
    };
    expect(claimed.status).toBe('attempted');

    const run = expectStatus(
      await student.post(`/practice/problems/${slug}/run`, { language: 'java', code: '// @sum' }),
      200,
    ).body as RunOutcome;
    expect(run.cases).toHaveLength(1);

    const wrong = expectStatus(
      await student.post(`/practice/problems/${slug}/submissions`, {
        language: 'java',
        code: '// @wrong',
      }),
      201,
    ).body as { newlySolved: boolean; cases: { hidden: boolean; input?: string }[] };
    expect(wrong.newlySolved).toBe(false);
    expect(wrong.cases.filter((c) => c.hidden).every((c) => c.input === undefined)).toBe(true);

    const right = expectStatus(
      await student.post(`/practice/problems/${slug}/submissions`, {
        language: 'java',
        code: '// @sum',
      }),
      201,
    ).body as { newlySolved: boolean; submission: { verdict: string; trust: string } };
    expect(right.newlySolved).toBe(true);
    expect(right.submission).toMatchObject({ verdict: 'passed', trust: 'trusted' });
    const again = expectStatus(
      await student.post(`/practice/problems/${slug}/submissions`, {
        language: 'java',
        code: '// @sum',
      }),
      201,
    ).body as { newlySolved: boolean };
    expect(again.newlySolved).toBe(false);

    const summary = expectStatus(await student.get('/practice/summary'), 200).body as {
      solved: number;
      points: number;
    };
    expect(summary.solved).toBeGreaterThanOrEqual(1);
    expect(summary.points).toBeGreaterThanOrEqual(15);
  });

  // ───────────────────────── who may do what ─────────────────────────

  it('keeps one learner out of another’s answers and out of the staff routes', async () => {
    const other = await prisma.studentProfile.findFirstOrThrow({
      where: { user: { email: TEST_ACCOUNTS.lockout.email } },
    });
    const theirs = await prisma.submission.create({
      data: {
        assignmentId,
        assignmentQuestionId: mcqPlacement,
        questionId: mcqId,
        studentId: other.id,
        attempt: 1,
        status: 'correct',
        marks: 2,
        maxMarks: 2,
      },
    });
    expect((await student.get(`/me/submissions/${theirs.id}`)).status).toBe(404);
    expect((await student.get('/assignments')).status).toBe(403);
    expect((await student.get('/submissions')).status).toBe(403);
    expect((await student.get(`/submissions/${theirs.id}`)).status).toBe(403);
    expect(
      (await student.post(`/submissions/${theirs.id}/reviews`, { decision: 'graded', marks: 0 }))
        .status,
    ).toBe(403);
    // Not published to them reads the same as not existing.
    expect((await student.get(`/me/assignments/${ZERO_UUID}`)).status).toBe(404);

    // The trainer teaches this learner's batch, but not the other learner's.
    expect((await trainer.get(`/submissions/${theirs.id}`)).status).toBe(403);
    await prisma.submission.delete({ where: { id: theirs.id } });
  });

  it('keeps a trainer out of a batch they do not teach', async () => {
    const response = await trainer.post(`/assignments/${assignmentId}/publish`, {
      batchId: otherBatchId,
    });
    expect([403, 404]).toContain(response.status);
    const learners = await trainer.post(`/assignments/${assignmentId}/publish`, {
      studentIds: [
        (
          await prisma.studentProfile.findFirstOrThrow({
            where: { user: { email: TEST_ACCOUNTS.lockout.email } },
          })
        ).id,
      ],
    });
    expect(learners.status).toBe(403);
  });

  it('keeps a trainer to their own batches and their own writing inside an assignment', async () => {
    const [foreign] = expectStatus(
      await admin.post(`/assignments/${assignmentId}/publish`, { batchId: otherBatchId }),
      201,
    ).body as AssignmentPublicationRecord[];

    const audiences = expectStatus(
      await trainer.get(`/assignments/${assignmentId}/publications`),
      200,
    ).body as AssignmentPublicationRecord[];
    expect(audiences.every((a) => a.batchId !== otherBatchId)).toBe(true);

    expect(
      (await trainer.delete(`/assignments/${assignmentId}/publications/${foreign!.id}`)).status,
    ).toBe(403);
    expect((await trainer.patch(`/assignments/${assignmentId}`, { title: 'Renamed' })).status).toBe(
      403,
    );
    expect((await trainer.delete(`/assignments/${assignmentId}`)).status).toBe(403);

    expectStatus(
      await admin.delete(`/assignments/${assignmentId}/publications/${foreign!.id}`),
      200,
    );
  });

  it('never runs learner code in the API process (ADR-0007, ADR-0016)', async () => {
    const none = new NoExecutionDriver();
    expect(none.available).toBe(false);
    await expect(
      none.execute({
        language: 'python',
        code: 'print(1)',
        cases: [{ id: 'a', stdin: '' }],
        limits: { timeMs: 1000, memoryMb: 64, outputBytes: 4096 },
      }),
    ).rejects.toBeInstanceOf(ExecutionUnavailableError);
  });
});
