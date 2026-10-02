import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  SYSTEM_ROLES,
  type AssignmentDetail,
  type CourseDetail,
  type LabAttemptRow,
  type LabDraftRecord,
  type LabInProgress,
  type LabRunView,
  type LabSummary,
  type LearnerQuestionWorkspace,
  type LessonDetail,
  type LessonLabView,
  type Paginated,
  type PlaygroundRunOutcome,
  type PracticeProblemCard,
  type PracticeProblemDetail,
  type PracticeSubmissionDetail,
  type PracticeSubmissionRecord,
  type PracticeSubmitOutcome,
  type PracticeSummary,
  type QuestionSummary,
  type QuestionValidation,
  type RunOutcome,
  type SubmissionView,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

/** A web lab's files as the platform carries them (ADR-0019). */
const page = (heading: string, marker = '') =>
  JSON.stringify({
    format: 'web/1',
    html: `<!doctype html><html><body><h1>${heading}</h1></body></html>`,
    css: 'h1 { color: #7f2331; }',
    js: marker ? `// ${marker}` : '',
  });
const check = (value: object) => JSON.stringify(value);
/** Only the hidden check and the reference solution carry this; a learner must never see it. */
const SECRET = 'reference-only-6491';

/**
 * Roadmap Phase 1, Labs and Playground (ADR-0018 to ADR-0021), through the API: a trainer writes
 * a web lab, saves it, previews it, publishes it and lists it; a learner finds it, keeps a draft,
 * runs it, submits it and sees the attempt recorded and their progress move; a lab placed in a
 * course completes its lesson wherever it is passed; and everyone outside the lab's audience is
 * refused. Code is never run here: the sandbox is the stand-in (setup/fake-execution.driver.ts),
 * and the real checks have their own suite in apps/runner (labs.sandbox.spec.ts).
 */
describe('Labs and Playground', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: Session;
  let admin: Session;
  let trainer: Session;
  let student: Session;
  let other: Session;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);

  let webLabId = '';
  let webSlug = '';
  let debugLabId = '';
  let debugSlug = '';
  let adminLabId = '';
  let submissionId = '';
  let courseId = '';
  let labLessonId = '';
  let debugLessonId = '';
  let otherBatchId = '';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    superAdmin = new Session(app);
    admin = new Session(app);
    trainer = new Session(app);
    student = new Session(app);
    other = new Session(app);
    expectStatus(await superAdmin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    expectStatus(await admin.login(TEST_ACCOUNTS.admin.email, password), 200);
    expectStatus(await trainer.login(TEST_ACCOUNTS.trainer.email, password), 200);
    expectStatus(await student.login(TEST_ACCOUNTS.student.email, password), 200);

    // A second learner, in the batch the trainer does not teach.
    const organization = await prisma.organization.findFirstOrThrow();
    const role = await prisma.role.findFirstOrThrow({
      where: { organizationId: organization.id, key: SYSTEM_ROLES.STUDENT },
    });
    const email = `labs-other-${unique}@test.local`;
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        email,
        name: 'Labs Other Learner',
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
      },
    });
    const profile = await prisma.studentProfile.create({
      data: { userId: user.id, studentCode: `STU-LAB-${unique}`, status: 'active' },
    });
    otherBatchId = (
      await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.otherBatchCode } })
    ).id;
    await prisma.batchMember.create({ data: { batchId: otherBatchId, studentId: profile.id } });
    expectStatus(await other.login(email, password), 200);
  });

  afterAll(async () => {
    await app.close();
  });

  // ───────────────────────── 1–4: the trainer's side ─────────────────────────

  it('1. lets a trainer write a web lab, which starts as a draft', async () => {
    const created = expectStatus(
      await trainer.post('/questions', {
        title: `Style the page heading ${unique}`,
        body: 'Give the page a heading that says what the page is for.',
        type: 'web',
        subject: 'javascript',
        difficulty: 'foundation',
        marks: 5,
        coding: {
          languages: ['web'],
          starterCode: { web: page('Start') },
          referenceSolution: { web: page(SECRET) },
          timeLimitMs: 2000,
          memoryLimitMb: 256,
          compareMode: 'trim',
          testCases: [
            {
              input: check({ kind: 'exists', selector: 'h1', min: 1, max: 1 }),
              expectedOutput: 'pass',
              isSample: true,
              label: 'Has one heading',
            },
            {
              input: check({ kind: 'text', selector: 'h1', match: 'equals', value: SECRET }),
              expectedOutput: 'pass',
              isSample: false,
            },
          ],
        },
      }),
      201,
    ).body as QuestionSummary;
    webLabId = created.id;
    expect(created.status).toBe('draft');
    webSlug = (await prisma.question.findUniqueOrThrow({ where: { id: webLabId } })).slug;
  });

  it('refuses a web lab whose check cannot work or whose files are too long', async () => {
    const base = {
      title: `A broken web lab ${unique}`,
      body: 'Broken on purpose.',
      type: 'web',
      subject: 'javascript',
      difficulty: 'foundation',
      marks: 1,
    };
    const badPattern = await trainer.post('/questions', {
      ...base,
      coding: {
        languages: ['web'],
        referenceSolution: { web: page('x') },
        testCases: [
          {
            input: check({ kind: 'text', selector: 'h1', match: 'matches', value: '([' }),
            expectedOutput: 'pass',
            isSample: true,
          },
        ],
      },
    });
    expect(badPattern.status).toBe(400);
    const tooLong = await trainer.post('/questions', {
      ...base,
      coding: {
        languages: ['web'],
        referenceSolution: {
          web: JSON.stringify({ format: 'web/1', html: 'x'.repeat(20_001), css: '', js: '' }),
        },
        testCases: [
          {
            input: check({ kind: 'exists', selector: 'h1', min: 1, max: null }),
            expectedOutput: 'pass',
            isSample: true,
          },
        ],
      },
    });
    expect(tooLong.status).toBe(400);
  });

  it('2. keeps the draft away from learners, and lets the trainer save it again', async () => {
    expect((await student.get(`/practice/problems/${webSlug}`)).status).toBe(404);
    // A learner cannot keep a draft for a lab they cannot reach either.
    const draft = await student.put('/practice/drafts', {
      scope: webLabId,
      language: 'web',
      code: page('mine'),
    });
    expect(draft.status).toBe(404);

    const mine = expectStatus(await trainer.get('/practice/labs?author=me'), 200)
      .body as Paginated<LabSummary>;
    const row = mine.data.find((lab) => lab.questionId === webLabId);
    expect(row).toMatchObject({ status: 'draft', validated: false, inCatalogue: false });
    expect(row?.canEdit).toBe(true);
  });

  it('3. previews the lab as a learner would see it, running only what learners may run', async () => {
    const preview = expectStatus(await trainer.get(`/practice/labs/${webLabId}/preview`), 200)
      .body as PracticeProblemDetail;
    expect(preview.preview).toEqual({ status: 'draft', inCatalogue: false });
    expect(preview.starterFiles?.html).toContain('Start');
    expect(preview.checks).toHaveLength(1);
    expect(preview.hiddenTestCount).toBe(1);
    expect(JSON.stringify(preview)).not.toContain(SECRET);

    const run = expectStatus(
      await trainer.post(`/practice/labs/${webLabId}/preview/run`, {
        language: 'web',
        code: page('Preview'),
        customInput: null,
      }),
      200,
    ).body as RunOutcome;
    expect(run.cases).toHaveLength(1);
    expect(run.cases[0]?.passed).toBe(true);
  });

  it('4. checks the lab in the sandbox, publishes it and puts it in the Labs catalogue', async () => {
    // Not checked yet: it cannot be listed.
    const early = await trainer.post(`/practice/labs/${webLabId}/catalogue`, {
      inCatalogue: true,
      points: 20,
    });
    expect(early.status).toBe(422);

    const validation = expectStatus(await trainer.post(`/questions/${webLabId}/validate`), 201)
      .body as QuestionValidation;
    expect(validation.ok).toBe(true);
    expectStatus(await trainer.post(`/questions/${webLabId}/status`, { status: 'published' }), 201);
    const listed = expectStatus(
      await trainer.post(`/practice/labs/${webLabId}/catalogue`, { inCatalogue: true, points: 20 }),
      200,
    ).body as QuestionSummary;
    expect(listed.id).toBe(webLabId);
  });

  it('lets a trainer edit only their own labs, and read the published ones of others', async () => {
    const theirs = expectStatus(
      await admin.post('/questions', {
        title: `An administrator's lab ${unique}`,
        body: 'Print the sum.',
        type: 'coding',
        subject: 'javascript',
        difficulty: 'foundation',
        marks: 2,
        coding: {
          languages: ['python'],
          referenceSolution: { python: '# @sum' },
          testCases: [{ input: '1 2\n', expectedOutput: '3', isSample: true }],
        },
      }),
      201,
    ).body as QuestionSummary;
    adminLabId = theirs.id;
    expectStatus(await admin.post(`/questions/${adminLabId}/validate`), 201);
    expectStatus(await admin.post(`/questions/${adminLabId}/status`, { status: 'published' }), 201);

    const refused = await trainer.post(`/practice/labs/${adminLabId}/catalogue`, {
      inCatalogue: true,
      points: 5,
    });
    expect(refused.status).toBe(403);
    // A reviewer follows learners on labs others wrote: published ones are listed, read-only.
    const listed = expectStatus(await trainer.get('/practice/labs'), 200)
      .body as Paginated<LabSummary>;
    expect(listed.data.find((lab) => lab.questionId === adminLabId)).toMatchObject({
      canEdit: false,
    });
    expectStatus(await trainer.get(`/practice/labs/${adminLabId}/preview`), 200);
    const mine = expectStatus(await trainer.get('/practice/labs?author=me'), 200)
      .body as Paginated<LabSummary>;
    expect(mine.data.some((lab) => lab.questionId === adminLabId)).toBe(false);
    // Someone else's draft stays theirs.
    const draft = expectStatus(
      await admin.post('/questions', {
        title: `An administrator's draft ${unique}`,
        body: 'Not ready.',
        type: 'coding',
        subject: 'javascript',
        difficulty: 'foundation',
        marks: 1,
        coding: {
          languages: ['python'],
          referenceSolution: { python: '# @sum' },
          testCases: [{ input: '1\n', expectedOutput: '1', isSample: true }],
        },
      }),
      201,
    ).body as QuestionSummary;
    expect((await trainer.get(`/practice/labs/${draft.id}/preview`)).status).toBe(403);
    // An administrator sees every lab.
    const all = expectStatus(await admin.get('/practice/labs?type=web'), 200)
      .body as Paginated<LabSummary>;
    expect(all.data.some((lab) => lab.questionId === webLabId)).toBe(true);
  });

  // ───────────────────────── 5–11: the learner's side ─────────────────────────

  it('5. lets the learner discover the lab in the catalogue', async () => {
    const found = expectStatus(await student.get('/practice/problems?type=web&pageSize=100'), 200)
      .body as Paginated<PracticeProblemCard>;
    const card = found.data.find((lab) => lab.questionId === webLabId);
    expect(card).toMatchObject({ type: 'web', status: 'not_attempted', points: 20 });
    const summary = expectStatus(await student.get('/practice/summary'), 200)
      .body as PracticeSummary;
    expect(summary.byType.web).toBeGreaterThanOrEqual(1);
  });

  it('6. opens the lab with its starting files and visible checks, and nothing hidden', async () => {
    const detail = expectStatus(await student.get(`/practice/problems/${webSlug}`), 200)
      .body as PracticeProblemDetail;
    expect(detail.type).toBe('web');
    expect(detail.starterFiles?.html).toContain('Start');
    expect(detail.checks).toEqual([
      expect.objectContaining({
        label: 'Has one heading',
        description: 'Exactly 1 element matches `h1`',
      }),
    ]);
    expect(detail.hiddenTestCount).toBe(1);
    expect(detail.preview).toBeUndefined();
    // Neither the hidden check nor the reference files reach a learner.
    expect(JSON.stringify(detail)).not.toContain(SECRET);

    // Work in progress is kept on the server, so it follows the learner to another device.
    const saved = expectStatus(
      await student.put('/practice/drafts', {
        scope: webLabId,
        language: 'web',
        code: page('Halfway'),
      }),
      200,
    ).body as LabDraftRecord;
    expect(saved.scope).toBe(webLabId);
    const drafts = expectStatus(await student.get(`/practice/drafts?scope=${webLabId}`), 200)
      .body as LabDraftRecord[];
    expect(drafts.map((d) => d.code)).toEqual([page('Halfway')]);
    const going = expectStatus(await student.get('/practice/in-progress'), 200)
      .body as LabInProgress[];
    expect(going.some((lab) => lab.questionId === webLabId)).toBe(true);
    // Another learner's drafts are their own.
    const theirs = expectStatus(await other.get('/practice/drafts?scope=playground'), 200)
      .body as LabDraftRecord[];
    expect(theirs).toEqual([]);
  });

  it('7–8. runs the visible checks in the sandbox and shows why one fails', async () => {
    const failing = expectStatus(
      await student.post(`/practice/problems/${webSlug}/run`, {
        language: 'web',
        code: page('Halfway', '@fail'),
        customInput: null,
      }),
      200,
    ).body as RunOutcome;
    expect(failing.cases).toHaveLength(1);
    expect(failing.cases[0]).toMatchObject({ passed: false, hidden: false });
    expect(failing.cases[0]?.actualOutput).toContain('Nothing matches');

    const passing = expectStatus(
      await student.post(`/practice/problems/${webSlug}/run`, {
        language: 'web',
        code: page('Done'),
        customInput: null,
      }),
      200,
    ).body as RunOutcome;
    expect(passing.cases[0]?.passed).toBe(true);

    // A page is checked, not run on input; and files that are not a page are refused.
    const custom = await student.post(`/practice/problems/${webSlug}/run`, {
      language: 'web',
      code: page('Done'),
      customInput: 'anything',
    });
    expect(problemCode(custom)).toBe('custom_input_not_offered');
    const notAPage = await student.post(`/practice/problems/${webSlug}/run`, {
      language: 'web',
      code: '<h1>no bundle</h1>',
      customInput: null,
    });
    expect(problemCode(notAPage)).toBe('invalid_web_files');
  });

  it('9–10. submits against every check, hidden ones included, and records the attempt', async () => {
    const wrong = expectStatus(
      await student.post(`/practice/problems/${webSlug}/submissions`, {
        language: 'web',
        code: page('Done', '@fail'),
      }),
      201,
    ).body as PracticeSubmitOutcome;
    expect(wrong.submission.verdict).not.toBe('passed');
    expect(wrong.cases.filter((c) => c.hidden).every((c) => c.input === undefined)).toBe(true);

    const right = expectStatus(
      await student.post(`/practice/problems/${webSlug}/submissions`, {
        language: 'web',
        code: page('Done'),
      }),
      201,
    ).body as PracticeSubmitOutcome;
    expect(right.submission).toMatchObject({
      verdict: 'passed',
      trust: 'trusted',
      passed: 2,
      total: 2,
    });
    expect(right.newlySolved).toBe(true);
    submissionId = right.submission.id;

    const history = expectStatus(
      await student.get(`/practice/problems/${webSlug}/submissions`),
      200,
    ).body as PracticeSubmissionRecord[];
    expect(history.map((r) => r.verdict)).toEqual(['passed', wrong.submission.verdict]);
    const one = expectStatus(
      await student.get(`/practice/problems/${webSlug}/submissions/${submissionId}`),
      200,
    ).body as PracticeSubmissionDetail;
    expect(one.code).toBe(page('Done'));
    expect(one.cases.map((c) => c.hidden)).toEqual([false, true]);
  });

  it('11. moves the learner’s progress: solved, points, and no longer in progress', async () => {
    const summary = expectStatus(await student.get('/practice/summary'), 200)
      .body as PracticeSummary;
    expect(summary.solved).toBeGreaterThanOrEqual(1);
    expect(summary.points).toBeGreaterThanOrEqual(20);
    const card = (
      expectStatus(await student.get('/practice/problems?type=web&pageSize=100'), 200)
        .body as Paginated<PracticeProblemCard>
    ).data.find((lab) => lab.questionId === webLabId);
    expect(card?.status).toBe('solved');
    const going = expectStatus(await student.get('/practice/in-progress'), 200)
      .body as LabInProgress[];
    expect(going.some((lab) => lab.questionId === webLabId)).toBe(false);
  });

  // ───────────────────────── 12: who may not ─────────────────────────

  it('12. keeps a learner out of another learner’s work and out of the staff routes', async () => {
    expect(
      (await other.get(`/practice/problems/${webSlug}/submissions/${submissionId}`)).status,
    ).toBe(404);
    expect((await student.get('/practice/labs')).status).toBe(403);
    expect((await student.get(`/practice/labs/${webLabId}/attempts`)).status).toBe(403);
    expect((await student.get(`/practice/runs/${submissionId}`)).status).toBe(403);
    expect(
      (
        await student.post(`/practice/labs/${webLabId}/catalogue`, {
          inCatalogue: false,
          points: 0,
        })
      ).status,
    ).toBe(403);
    const anonymous = new Session(app);
    expect((await anonymous.get('/practice/problems')).status).toBe(401);
    expect((await anonymous.get('/practice/drafts?scope=playground')).status).toBe(401);
  });

  it('shows a trainer the attempts of their own batches only, with the code', async () => {
    // The other learner, outside the trainer's batches, submits too.
    const theirs = expectStatus(
      await other.post(`/practice/problems/${webSlug}/submissions`, {
        language: 'web',
        code: page('Theirs', '@fail'),
      }),
      201,
    ).body as PracticeSubmitOutcome;

    const attempts = expectStatus(await trainer.get(`/practice/labs/${webLabId}/attempts`), 200)
      .body as Paginated<LabAttemptRow>;
    expect(attempts.data).toHaveLength(1);
    expect(attempts.data[0]).toMatchObject({ solved: true, bestVerdict: 'passed', submissions: 2 });
    const view = expectStatus(
      await trainer.get(`/practice/runs/${attempts.data[0]!.latestRunId}`),
      200,
    ).body as LabRunView;
    expect(view.code).toBe(page('Done'));
    expect(view.cases.some((c) => c.hidden)).toBe(true);

    expect((await trainer.get(`/practice/runs/${theirs.submission.id}`)).status).toBe(404);
    expect(
      (await trainer.get(`/practice/labs/${webLabId}/attempts?batchId=${otherBatchId}`)).status,
    ).toBe(403);

    // An administrator reviews everyone.
    const everyone = expectStatus(await admin.get(`/practice/labs/${webLabId}/attempts`), 200)
      .body as Paginated<LabAttemptRow>;
    expect(everyone.data).toHaveLength(2);
    const solved = expectStatus(
      await admin.get(`/practice/labs/${webLabId}/attempts?status=solved`),
      200,
    ).body as Paginated<LabAttemptRow>;
    expect(solved.data).toHaveLength(1);
  });

  // ───────────────────────── debugging labs ─────────────────────────

  it('checks a debugging lab both ways: the fix passes and the code with the bug fails', async () => {
    const draft = {
      title: `Fix the total ${unique}`,
      body: 'The program should print the sum of the numbers it reads, but it does not.',
      type: 'debugging',
      subject: 'javascript',
      difficulty: 'foundation',
      marks: 3,
      coding: {
        languages: ['python'],
        // Already right: there would be nothing to fix.
        starterCode: { python: '# @sum' },
        referenceSolution: { python: '# @sum' },
        expectedBehaviour: 'Prints the sum of the integers on its one line of input.',
        testCases: [
          { input: '1 2\n', expectedOutput: '3', isSample: true },
          { input: '5 5 5\n', expectedOutput: '15', isSample: false },
        ],
      },
    };
    const created = expectStatus(await admin.post('/questions', draft), 201)
      .body as QuestionSummary;
    debugLabId = created.id;
    const nothingToFix = expectStatus(await admin.post(`/questions/${debugLabId}/validate`), 201)
      .body as QuestionValidation;
    expect(nothingToFix.ok).toBe(false);
    expect(nothingToFix.languages[0]?.message).toContain('already passes');

    expectStatus(
      await admin.put(`/questions/${debugLabId}`, {
        ...draft,
        coding: { ...draft.coding, starterCode: { python: '# @wrong' } },
      }),
      200,
    );
    const fixed = expectStatus(await admin.post(`/questions/${debugLabId}/validate`), 201)
      .body as QuestionValidation;
    expect(fixed.ok).toBe(true);
    expectStatus(await admin.post(`/questions/${debugLabId}/status`, { status: 'published' }), 201);
    expectStatus(
      await admin.post(`/questions/${debugLabId}/practice`, { inCatalogue: true, points: 10 }),
      201,
    );
    debugSlug = (await prisma.question.findUniqueOrThrow({ where: { id: debugLabId } })).slug;
    const detail = expectStatus(await student.get(`/practice/problems/${debugSlug}`), 200)
      .body as PracticeProblemDetail;
    expect(detail.type).toBe('debugging');
    expect(detail.expectedBehaviour).toContain('sum of the integers');
    expect(detail.starterCode['python']).toBe('# @wrong');
  });

  it('puts debugging and web labs in assignments, each in its own workspace (TRN-11)', async () => {
    const assignment = expectStatus(
      await admin.post('/assignments', {
        title: `Labs in an assignment ${unique}`,
        subject: 'javascript',
        settings: {
          attemptsPerQuestion: 2,
          explanationPolicy: 'never',
          duePolicy: 'allow_late',
          gradingMethod: 'best',
        },
      }),
      201,
    ).body as { id: string };
    const structured = expectStatus(
      await admin.put(`/assignments/${assignment.id}/structure`, {
        modules: [
          {
            title: 'Labs',
            unlockRule: { type: 'always' },
            questions: [{ questionId: webLabId }, { questionId: debugLabId }],
          },
        ],
      }),
      200,
    ).body as AssignmentDetail;
    const [webPlacement, debugPlacement] = structured.modules[0]!.questions.map((q) => q.id);
    // Given to this spec's own learner, so no other spec's learner sees it.
    const learner = await prisma.studentProfile.findFirstOrThrow({
      where: { user: { email: `labs-other-${unique}@test.local` } },
    });
    expectStatus(
      await admin.post(`/assignments/${assignment.id}/publish`, {
        studentIds: [learner.id],
        opensAt: new Date(Date.now() - 60_000).toISOString(),
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
      }),
      201,
    );
    const base = `/me/assignments/${assignment.id}/questions`;

    const web = expectStatus(await other.get(`${base}/${webPlacement}`), 200)
      .body as LearnerQuestionWorkspace;
    expect(web.question.coding?.starterFiles?.html).toContain('Start');
    expect(web.question.coding?.samples).toEqual([]);
    expect(web.question.coding?.checks.map((c) => c.label)).toEqual(['Has one heading']);
    expect(web.question.coding?.hiddenCount).toBe(1);
    expect(JSON.stringify(web)).not.toContain(SECRET);

    const debugging = expectStatus(await other.get(`${base}/${debugPlacement}`), 200)
      .body as LearnerQuestionWorkspace;
    expect(debugging.question.coding?.expectedBehaviour).toContain('sum of the integers');
    expect(debugging.question.coding?.starterCode['python']).toBe('# @wrong');

    // Marked in the sandbox like any code: every check and case, the hidden ones included.
    const page1 = expectStatus(
      await other.post(`${base}/${webPlacement}/submissions`, {
        language: 'web',
        code: page(SECRET),
      }),
      201,
    ).body as SubmissionView;
    expect(page1.status).toBe('correct');
    expect(page1.cases.filter((c) => c.hidden)).toHaveLength(1);
    expect(JSON.stringify(page1.cases)).not.toContain(SECRET);
    const fixed = expectStatus(
      await other.post(`${base}/${debugPlacement}/submissions`, {
        language: 'python',
        code: '# @sum',
      }),
      201,
    ).body as SubmissionView;
    expect(fixed.status).toBe('correct');
  });

  it('keeps debugging and web labs off timed papers, which have no workspace for them', async () => {
    const paper = expectStatus(
      await admin.post('/tests', {
        title: `No labs on a paper ${unique}`,
        kind: 'weekly',
        subject: 'javascript',
      }),
      201,
    ).body as { id: string };
    const refused = await admin.put(`/tests/${paper.id}/paper`, {
      sections: [
        { title: 'Labs', instructions: '', questions: [{ questionId: webLabId }] },
        { title: 'Debug', instructions: '', questions: [{ questionId: debugLabId }] },
      ],
    });
    expect(refused.status).toBe(400);
    expect(JSON.stringify(refused.body)).toContain('cannot be answered in a timed test');
    await prisma.test.delete({ where: { id: paper.id } });
  });

  // ───────────────────────── a lab inside a course ─────────────────────────

  it('places labs in a course only when they are live, and checks practice questions too', async () => {
    courseId = (
      expectStatus(
        await admin.post('/courses', { title: `Labs course ${unique}`, level: 'beginner' }),
        201,
      ).body as { id: string }
    ).id;
    const draftLab = expectStatus(
      await admin.post('/questions', {
        title: `Not ready ${unique}`,
        body: 'A draft.',
        type: 'coding',
        subject: 'javascript',
        difficulty: 'foundation',
        marks: 1,
        coding: {
          languages: ['python'],
          referenceSolution: { python: '# @sum' },
          testCases: [{ input: '1\n', expectedOutput: '1', isSample: true }],
        },
      }),
      201,
    ).body as QuestionSummary;
    const notLive = await admin.put(`/courses/${courseId}/outline`, {
      modules: [
        {
          title: 'Labs',
          unlockRule: { type: 'always' },
          lessons: [
            { title: 'A lab', type: 'lab', content: { html: '', questionId: draftLab.id } },
          ],
        },
      ],
    });
    expect(notLive.status).toBe(400);
    const noLab = await admin.put(`/courses/${courseId}/outline`, {
      modules: [
        {
          title: 'Labs',
          unlockRule: { type: 'always' },
          lessons: [{ title: 'A lab', type: 'lab' }],
        },
      ],
    });
    expect(noLab.status).toBe(400);
    const missingQuestion = await admin.put(`/courses/${courseId}/outline`, {
      modules: [
        {
          title: 'Practice',
          unlockRule: { type: 'always' },
          lessons: [
            {
              title: 'A question',
              type: 'practice',
              content: { html: '', questionId: '00000000-0000-4000-8000-000000000000' },
            },
          ],
        },
      ],
    });
    expect(missingQuestion.status).toBe(400);

    const outline = expectStatus(
      await admin.put(`/courses/${courseId}/outline`, {
        modules: [
          {
            title: 'Labs',
            unlockRule: { type: 'always' },
            lessons: [
              {
                title: 'Style a heading',
                type: 'lab',
                content: { html: '', questionId: webLabId },
              },
              {
                title: 'Fix the total',
                type: 'lab',
                content: { html: '', questionId: debugLabId },
              },
            ],
          },
        ],
      }),
      200,
    ).body as CourseDetail;
    labLessonId = outline.modules[0]!.lessons[0]!.id;
    debugLessonId = outline.modules[0]!.lessons[1]!.id;
    expect(outline.modules[0]!.lessons.map((l) => l.completionRule)).toEqual(['pass', 'pass']);
    const batchId = (
      await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.assignedBatchCode } })
    ).id;
    expectStatus(
      await admin.post(`/courses/${courseId}/publish`, { scopeType: 'batch', scopeId: batchId }),
      201,
    );
  });

  it('opens a lab lesson, refuses "mark complete", and completes it when the lab is passed there', async () => {
    const lesson = expectStatus(await student.get(`/lessons/${debugLessonId}`), 200)
      .body as LessonDetail;
    expect(lesson.type).toBe('lab');
    expect(lesson.lab).toMatchObject({ questionId: debugLabId, type: 'debugging', solved: false });
    expect(lesson.status).not.toBe('completed');
    expect(problemCode(await student.post(`/lessons/${debugLessonId}/complete`))).toBe(
      'lesson_completes_on_pass',
    );

    const view = expectStatus(await student.get(`/lessons/${debugLessonId}/lab`), 200)
      .body as LessonLabView;
    expect(view).toMatchObject({ available: true, completed: false, courseId });
    expect(view.problem?.questionId).toBe(debugLabId);

    const run = expectStatus(
      await student.post(`/lessons/${debugLessonId}/lab/run`, {
        language: 'python',
        code: '# @sum',
        customInput: null,
      }),
      200,
    ).body as RunOutcome;
    expect(run.passed).toBe(run.total);
    const submitted = expectStatus(
      await student.post(`/lessons/${debugLessonId}/lab/submissions`, {
        language: 'python',
        code: '# @sum',
      }),
      201,
    ).body as PracticeSubmitOutcome & { lessonCompleted: boolean };
    expect(submitted.lessonCompleted).toBe(true);
    const history = expectStatus(
      await student.get(`/lessons/${debugLessonId}/lab/submissions`),
      200,
    ).body as PracticeSubmissionRecord[];
    expect(history[0]?.verdict).toBe('passed');
    const after = expectStatus(await student.get(`/lessons/${debugLessonId}`), 200)
      .body as LessonDetail;
    expect(after.status).toBe('completed');
    expect(after.lab?.solved).toBe(true);
    // Completed once: one activity entry, however many paths completed it.
    const student1 = await prisma.studentProfile.findFirstOrThrow({
      where: { user: { email: TEST_ACCOUNTS.student.email } },
    });
    await new Promise((done) => setTimeout(done, 300));
    const entries = await prisma.activityEvent.count({
      where: { entityId: debugLessonId, type: 'lesson.completed', userId: student1.userId },
    });
    expect(entries).toBe(1);
  });

  it('completes a lab lesson whose lab was passed before it was opened', async () => {
    // The web lab was solved in the catalogue (step 9); its lesson completes on opening.
    const lesson = expectStatus(await student.get(`/lessons/${labLessonId}`), 200)
      .body as LessonDetail;
    expect(lesson.lab).toMatchObject({ questionId: webLabId, solved: true });
    expect(lesson.status).toBe('completed');
  });

  it('completes the lesson from the catalogue too, through the progress listener', async () => {
    // A fresh lesson opening the debugging lab, which the learner then passes in the catalogue.
    const before = expectStatus(await admin.get(`/courses/${courseId}`), 200).body as CourseDetail;
    const module = before.modules[0]!;
    const outline = expectStatus(
      await admin.put(`/courses/${courseId}/outline`, {
        modules: [
          {
            id: module.id,
            title: module.title,
            unlockRule: { type: 'always' },
            lessons: [
              ...module.lessons.map((l) => ({ id: l.id, title: l.title, type: l.type })),
              { title: 'Fix it again', type: 'lab', content: { html: '', questionId: debugLabId } },
            ],
          },
        ],
      }),
      200,
    ).body as CourseDetail;
    const freshId = outline.modules[0]!.lessons[2]!.id;
    const learner = await prisma.studentProfile.findFirstOrThrow({
      where: { user: { email: TEST_ACCOUNTS.student.email } },
    });
    expect(
      await prisma.lessonProgress.findFirst({
        where: { studentId: learner.id, lessonId: freshId },
      }),
    ).toBeNull();
    expectStatus(
      await student.post(`/practice/problems/${debugSlug}/submissions`, {
        language: 'python',
        code: '# @sum',
      }),
      201,
    );
    let status: string | undefined;
    for (let i = 0; i < 20 && status !== 'completed'; i += 1) {
      await new Promise((done) => setTimeout(done, 100));
      status = (
        await prisma.lessonProgress.findFirst({
          where: { studentId: learner.id, lessonId: freshId },
        })
      )?.status;
    }
    expect(status).toBe('completed');
  });

  it('says a lab lesson is unavailable while Labs are switched off', async () => {
    expectStatus(await superAdmin.patch('/flags/module.practice', { enabled: false }), 200);
    try {
      expect(problemCode(await student.get('/practice/problems'))).toBe('module_disabled');
      const view = expectStatus(await student.get(`/lessons/${debugLessonId}/lab`), 200)
        .body as LessonLabView;
      expect(view).toMatchObject({ available: false, problem: null });
      expect(
        problemCode(
          await student.post(`/lessons/${debugLessonId}/lab/run`, {
            language: 'python',
            code: '# @sum',
            customInput: null,
          }),
        ),
      ).toBe('lab_unavailable');
    } finally {
      expectStatus(await superAdmin.patch('/flags/module.practice', { enabled: true }), 200);
    }
  });

  it('keeps a learner outside the course out of its lab lessons', async () => {
    expect((await other.get(`/lessons/${debugLessonId}/lab`)).status).toBe(403);
    expect(
      (
        await other.post(`/lessons/${debugLessonId}/lab/submissions`, {
          language: 'python',
          code: '# @sum',
        })
      ).status,
    ).toBe(403);
  });

  // ───────────────────────── the playground ─────────────────────────

  it('runs playground code in the sandbox on the learner’s own input, within its limits', async () => {
    const ran = expectStatus(
      await student.post('/practice/playground/run', {
        language: 'python',
        code: '# @sum',
        stdin: '2 3 4',
      }),
      200,
    ).body as PlaygroundRunOutcome;
    expect(ran.output.stdout).toBe('9\n');
    expect(ran.limits).toEqual({ timeMs: 5000, memoryMb: 256 });

    // A web page has its own lab, and the input has a size limit.
    expect(
      (await student.post('/practice/playground/run', { language: 'web', code: page('x') })).status,
    ).toBe(400);
    expect(
      (
        await student.post('/practice/playground/run', {
          language: 'python',
          code: 'print(1)',
          stdin: 'x'.repeat(16_001),
        })
      ).status,
    ).toBe(400);

    // Playground drafts, one per language, are the learner's own.
    expectStatus(
      await student.put('/practice/drafts', {
        scope: 'playground',
        language: 'python',
        code: 'print(1)',
        stdin: '',
      }),
      200,
    );
    expect(
      (
        expectStatus(await student.get('/practice/drafts?scope=playground'), 200)
          .body as LabDraftRecord[]
      ).map((d) => d.language),
    ).toEqual(['python']);
    expectStatus(await student.delete('/practice/drafts?scope=playground&language=python'), 204);
    expect(expectStatus(await student.get('/practice/drafts?scope=playground'), 200).body).toEqual(
      [],
    );
  });

  it('runs one execution at a time per person', async () => {
    const [first, second] = await Promise.all([
      student.post('/practice/playground/run', {
        language: 'python',
        code: '# @slow @sum',
        stdin: '1',
      }),
      new Promise<Awaited<ReturnType<Session['post']>>>((done) =>
        setTimeout(
          () =>
            void student
              .post('/practice/playground/run', { language: 'python', code: '# @sum', stdin: '1' })
              .then(done),
          100,
        ),
      ),
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(problemCode(second)).toBe('execution_in_progress');
    // Someone else is not held up by it.
    expect(
      (
        await other.post('/practice/playground/run', {
          language: 'python',
          code: '# @sum',
          stdin: '1',
        })
      ).status,
    ).toBe(200);
  });
});
