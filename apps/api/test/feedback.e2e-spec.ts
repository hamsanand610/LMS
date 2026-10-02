import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  SYSTEM_ROLES,
  toLocalDateKey,
  type DashboardResponse,
  type FeedbackFormDetail,
  type FeedbackFormSummary,
  type FeedbackResults,
  type LearnerFeedbackItem,
  type Paginated,
  type ReportData,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { FeedbackService } from '../src/modules/feedback/index.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

const HOUR = 3_600_000;

/**
 * Feedback (F-18, Phases 3–4 D10). An administrator gives a form to a batch; its learners answer
 * once each, anonymously unless the form says otherwise, and nothing then ties an answer to them
 * (AC-13.2); the trainer it is about sees its figures once five have answered, and nobody else's.
 */
describe('feedback', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let trainer: Session;
  let student: Session;
  const learners: Session[] = [];
  const learnerIds: string[] = [];
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);

  let organizationId = '';
  let batchId = '';
  let trainerId = '';
  let otherTrainerId = '';
  let anonymousId = '';
  let namedId = '';
  let otherTrainersFormId = '';

  const form = (title: string, extra: object = {}) => ({
    title,
    batchId,
    trainerId,
    opensAt: new Date(Date.now() - HOUR).toISOString(),
    closesAt: new Date(Date.now() + 24 * HOUR).toISOString(),
    questions: [
      { id: 'pace', kind: 'rating', prompt: 'How was the pace?' },
      { id: 'best', kind: 'choice', prompt: 'What helped most?', options: ['Labs', 'Lectures'] },
      { id: 'note', kind: 'text', prompt: 'Anything else?', required: false },
    ],
    ...extra,
  });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    organizationId = (await prisma.organization.findFirstOrThrow()).id;
    admin = new Session(app);
    trainer = new Session(app);
    student = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.admin.email, password), 200);
    expectStatus(await trainer.login(TEST_ACCOUNTS.trainer.email, password), 200);
    expectStatus(await student.login(TEST_ACCOUNTS.student.email, password), 200);
    trainerId = (
      await prisma.trainerProfile.findFirstOrThrow({
        where: { user: { email: TEST_ACCOUNTS.trainer.email } },
      })
    ).id;
    const assigned = await prisma.batch.findUniqueOrThrow({
      where: { code: TEST_FIXTURES.assignedBatchCode },
    });
    // A batch of its own, so the answers counted here are only these learners'.
    batchId = (
      await prisma.batch.create({
        data: {
          organizationId,
          programId: assigned.programId,
          code: `FB-${unique}`,
          name: `Feedback batch ${unique}`,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'running',
        },
      })
    ).id;
    const role = await prisma.role.findFirstOrThrow({
      where: { organizationId, key: SYSTEM_ROLES.STUDENT },
    });
    for (let i = 0; i < 5; i += 1) {
      const email = `feedback-${i}-${unique}@test.local`;
      const user = await prisma.user.create({
        data: {
          organizationId,
          email,
          name: `Feedback Learner ${i}`,
          passwordHash: await hashPassword(password),
          status: 'active',
          emailVerifiedAt: new Date(),
          roles: { create: [{ roleId: role.id }] },
        },
      });
      const profile = await prisma.studentProfile.create({
        data: { userId: user.id, studentCode: `STU-FB-${i}-${unique}`, status: 'active' },
      });
      learnerIds.push(profile.id);
      await prisma.batchMember.create({ data: { batchId, studentId: profile.id } });
      const session = new Session(app);
      expectStatus(await session.login(email, password), 200);
      learners.push(session);
    }
    const otherTrainerUser = await prisma.user.create({
      data: {
        organizationId,
        email: `feedback-trainer-${unique}@test.local`,
        name: 'Another Trainer',
        passwordHash: await hashPassword(password),
        status: 'active',
      },
    });
    otherTrainerId = (await prisma.trainerProfile.create({ data: { userId: otherTrainerUser.id } }))
      .id;
  });

  afterAll(async () => {
    await prisma.batchMember.updateMany({
      where: { batchId },
      data: { isActive: false, leftAt: new Date() },
    });
    await prisma.batch.update({ where: { id: batchId }, data: { deletedAt: new Date() } });
    await app.close();
  });

  it('is given by an administrator, and by nobody else', async () => {
    expect((await trainer.post('/feedback/forms', form(`Trainer form ${unique}`))).status).toBe(
      403,
    );
    expect((await student.post('/feedback/forms', form(`Learner form ${unique}`))).status).toBe(
      403,
    );
    const created = expectStatus(
      await admin.post('/feedback/forms', form(`Week one ${unique}`)),
      201,
    ).body as FeedbackFormDetail;
    anonymousId = created.id;
    expect(created.anonymous, 'anonymous unless the form says otherwise').toBe(true);
    expect(created.status).toBe('open');
    namedId = (
      expectStatus(
        await admin.post('/feedback/forms', form(`Named ${unique}`, { anonymous: false })),
        201,
      ).body as FeedbackFormDetail
    ).id;
    otherTrainersFormId = (
      expectStatus(
        await admin.post(
          '/feedback/forms',
          form(`About someone else ${unique}`, { trainerId: otherTrainerId }),
        ),
        201,
      ).body as FeedbackFormDetail
    ).id;
    // The batch is told it is open.
    expect(
      await prisma.notification.count({
        where: { type: 'feedback.open', link: `/feedback/${anonymousId}` },
      }),
    ).toBe(5);
  });

  it('reaches the learners of its batch only', async () => {
    const open = expectStatus(await learners[0]!.get('/me/feedback'), 200)
      .body as LearnerFeedbackItem[];
    expect(open.map((f) => f.formId)).toEqual(expect.arrayContaining([anonymousId, namedId]));
    expect(open.find((f) => f.formId === anonymousId)?.answered).toBe(false);
    const elsewhere = expectStatus(await student.get('/me/feedback'), 200)
      .body as LearnerFeedbackItem[];
    expect(elsewhere.map((f) => f.formId)).not.toContain(anonymousId);
    const refused = await student.post(`/me/feedback/${anonymousId}/responses`, {
      answers: { pace: 5, best: 'Labs' },
    });
    expect(refused.status).toBe(404);
  });

  it('checks the answers against the questions', async () => {
    for (const answers of [
      { best: 'Labs' },
      { pace: 9, best: 'Labs' },
      { pace: 4, best: 'Homework' },
      { pace: 'great', best: 'Labs' },
    ]) {
      const refused = await learners[0]!.post(`/me/feedback/${anonymousId}/responses`, { answers });
      expect(refused.status, JSON.stringify(answers)).toBe(400);
    }
  });

  it('takes one answer per learner, and keeps an anonymous one nameless', async () => {
    expectStatus(
      await learners[0]!.post(`/me/feedback/${anonymousId}/responses`, {
        answers: { pace: 4, best: 'Labs', note: 'More labs please' },
      }),
      201,
    );
    const again = await learners[0]!.post(`/me/feedback/${anonymousId}/responses`, {
      answers: { pace: 1, best: 'Lectures' },
    });
    expect(again.status).toBe(409);
    expect(problemCode(again)).toBe('feedback_answered');
    const stored = await prisma.feedbackResponse.findMany({ where: { formId: anonymousId } });
    expect(stored).toHaveLength(1);
    expect(stored[0]!.studentId, 'no learner on an anonymous answer').toBeNull();
    expect(JSON.stringify(stored[0])).not.toContain(learnerIds[0]!);
    const open = expectStatus(await learners[0]!.get('/me/feedback'), 200)
      .body as LearnerFeedbackItem[];
    expect(open.find((f) => f.formId === anonymousId)?.answered).toBe(true);
  });

  it('shows nothing but counts below five answers', async () => {
    const early = expectStatus(await admin.get(`/feedback/forms/${anonymousId}/results`), 200)
      .body as FeedbackResults;
    expect(early.responses).toBe(1);
    expect(early.suppressed).toBe(true);
    expect(early.questions.every((q) => q.average === null && q.comments.length === 0)).toBe(true);
    for (const [index, session] of learners.slice(1).entries()) {
      expectStatus(
        await session.post(`/me/feedback/${anonymousId}/responses`, {
          answers: { pace: index + 2, best: index % 2 === 0 ? 'Labs' : 'Lectures' },
        }),
        201,
      );
    }
    const full = expectStatus(await admin.get(`/feedback/forms/${anonymousId}/results`), 200)
      .body as FeedbackResults;
    expect(full.suppressed).toBe(false);
    expect(full.audience).toBe(5);
    const pace = full.questions.find((q) => q.id === 'pace')!;
    expect(pace.average).toBe(3.6);
    expect(pace.distribution).toEqual([0, 1, 1, 2, 1]);
    const note = full.questions.find((q) => q.id === 'note')!;
    expect(note.comments).toEqual([{ text: 'More labs please', name: null }]);
  });

  it('names who answered a named form, to administrators only', async () => {
    for (const session of learners) {
      expectStatus(
        await session.post(`/me/feedback/${namedId}/responses`, {
          answers: { pace: 5, best: 'Labs', note: 'Signed' },
        }),
        201,
      );
    }
    const forAdmin = expectStatus(await admin.get(`/feedback/forms/${namedId}/results`), 200)
      .body as FeedbackResults;
    const names = forAdmin.questions.find((q) => q.id === 'note')!.comments.map((c) => c.name);
    expect(names.every((name) => typeof name === 'string' && name.startsWith('Feedback'))).toBe(
      true,
    );
    const forTrainer = expectStatus(await trainer.get(`/feedback/forms/${namedId}/results`), 200)
      .body as FeedbackResults;
    expect(forTrainer.questions.find((q) => q.id === 'note')!.comments.every((c) => !c.name)).toBe(
      true,
    );
  });

  it('shows a trainer the forms about them, and no one else’s', async () => {
    const mine = expectStatus(await trainer.get('/feedback/forms?pageSize=100'), 200)
      .body as Paginated<FeedbackFormSummary>;
    expect(mine.data.map((f) => f.id)).toEqual(expect.arrayContaining([anonymousId, namedId]));
    expect(mine.data.map((f) => f.id)).not.toContain(otherTrainersFormId);
    expect(mine.data.every((f) => f.trainer?.id === trainerId)).toBe(true);
    expect((await trainer.get(`/feedback/forms/${otherTrainersFormId}/results`)).status).toBe(404);
    expect((await student.get(`/feedback/forms/${anonymousId}/results`)).status).toBe(403);
    expect((await trainer.post(`/feedback/forms/${anonymousId}/close`)).status).toBe(403);
  });

  it('keeps a trainer’s filters to the feedback about them', async () => {
    // The other trainer shares a batch with this one, so only the rule keeps their rows apart.
    const assigned = await prisma.batch.findUniqueOrThrow({
      where: { code: TEST_FIXTURES.assignedBatchCode },
    });
    const shared = await prisma.batchTrainer.create({
      data: { batchId: assigned.id, trainerId: otherTrainerId, subject: 'core-java' },
    });
    try {
      const forms = expectStatus(
        await trainer.get(`/feedback/forms?trainerId=${otherTrainerId}`),
        200,
      ).body as Paginated<FeedbackFormSummary>;
      expect(forms.data).toHaveLength(0);
      const theirs = expectStatus(
        await trainer.get(`/reports/trainers?trainerId=${otherTrainerId}`),
        200,
      ).body as ReportData;
      expect(theirs.rows.map((row) => row['trainerId'])).not.toContain(otherTrainerId);
      const own = expectStatus(await trainer.get('/reports/trainers'), 200).body as ReportData;
      expect(own.rows.map((row) => row['trainerId'])).toEqual([trainerId]);
    } finally {
      await prisma.batchTrainer.delete({ where: { id: shared.id } });
    }
  });

  it('counts whole rounds only, so no choice of dates singles out one answer', async () => {
    const { timezone } = await prisma.organization.findFirstOrThrow();
    const round = toLocalDateKey(
      (await prisma.feedbackForm.findUniqueOrThrow({ where: { id: anonymousId } })).opensAt,
      timezone,
    );
    const nextDay = new Date(Date.parse(`${round}T00:00:00.000Z`) + 24 * HOUR)
      .toISOString()
      .slice(0, 10);
    // One of the round's five answers came in the next day; no range may split it off.
    const moved = await prisma.feedbackResponse.findFirstOrThrow({
      where: { formId: anonymousId },
    });
    await prisma.feedbackResponse.update({
      where: { id: moved.id },
      data: { submittedOn: new Date(`${nextDay}T00:00:00.000Z`) },
    });
    const title = encodeURIComponent(`Week one ${unique}`);
    const onRoundDay = expectStatus(
      await admin.get(`/reports/feedback?from=${round}&to=${round}&q=${title}`),
      200,
    ).body as ReportData;
    expect(onRoundDay.rows).toHaveLength(1);
    expect(onRoundDay.rows[0]).toMatchObject({ responses: 5, averageRating: 3.6 });
    const nextDayOnly = expectStatus(
      await admin.get(`/reports/feedback?from=${nextDay}&to=${nextDay}&q=${title}`),
      200,
    ).body as ReportData;
    expect(nextDayOnly.rows).toHaveLength(0);
  });

  it('shows feedback figures only to those who read feedback', async () => {
    const role = await prisma.role.findFirstOrThrow({
      where: { organizationId, key: SYSTEM_ROLES.PLACEMENT_COORDINATOR },
    });
    const email = `feedback-placement-${unique}@test.local`;
    await prisma.user.create({
      data: {
        organizationId,
        email,
        name: 'Placement Reader',
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
      },
    });
    const coordinator = new Session(app);
    expectStatus(await coordinator.login(email, password), 200);
    const report = expectStatus(await coordinator.get('/reports/trainers'), 200).body as ReportData;
    expect(report.rows.length).toBeGreaterThan(0);
    expect(
      report.rows.every((row) => row['feedbackRating'] === null && row['feedbackAnswers'] === null),
    ).toBe(true);
    const dashboard = expectStatus(await coordinator.get('/reports/dashboard'), 200)
      .body as DashboardResponse;
    expect(dashboard.metrics.find((m) => m.key === 'feedback.rating')?.pending).toMatch(
      /permission/,
    );
    // An administrator reads all feedback: the trainer's rating from their rounds of five.
    const forAdmin = expectStatus(await admin.get(`/reports/trainers?trainerId=${trainerId}`), 200)
      .body as ReportData;
    expect(forAdmin.rows[0]?.['feedbackRating']).toEqual(expect.any(Number));
    await prisma.user.update({
      where: { email },
      data: { status: 'deactivated', deletedAt: new Date() },
    });
  });

  it('stops taking answers once closed', async () => {
    expectStatus(await admin.post(`/feedback/forms/${otherTrainersFormId}/close`), 201);
    const late = await learners[0]!.post(`/me/feedback/${otherTrainersFormId}/responses`, {
      answers: { pace: 3, best: 'Labs' },
    });
    expect(late.status).toBe(422);
    expect(problemCode(late)).toBe('feedback_not_open');
  });

  it('announces each round once', async () => {
    const service = app.get(FeedbackService);
    expect(await service.announceOpenRounds()).toBe(0);
  });
});
