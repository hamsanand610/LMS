import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { SYSTEM_ROLES, type CourseSummary, type QuestionSummary } from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { NotificationsService } from '../src/modules/notifications/index.js';
import { ProgressService } from '../src/modules/progress/progress.service.js';
import { createTestApp } from './setup/app.js';
import { eventually } from './setup/eventually.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

/**
 * Phase 5: the lifecycle of a learner, a batch and a programme, and what each change does to the
 * courses a learner reaches — while their record (progress, submissions, attendance, certificates,
 * audit history) stays whole. The rule is in EnrollmentService and the phase record, §6.
 */
describe('learner, batch and programme lifecycle', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);

  let organizationId = '';
  let programId = '';
  let batchId = '';
  let finishedId = '';
  let openId = '';
  const courses: string[] = [];
  let classId = '';

  type Learner = { session: Session; email: string; userId: string; studentId: string };
  let leaver: Learner;
  let stayer: Learner;

  async function learner(label: string): Promise<Learner> {
    const role = await prisma.role.findFirstOrThrow({
      where: { organizationId, key: SYSTEM_ROLES.STUDENT },
    });
    const email = `life-${label}-${unique}@test.local`;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `Lifecycle ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
      },
    });
    const profile = await prisma.studentProfile.create({
      data: { userId: user.id, studentCode: `STU-LIFE-${label}-${unique}`, status: 'active' },
    });
    const session = new Session(app);
    expectStatus(await session.login(email, password), 200);
    return { session, email, userId: user.id, studentId: profile.id };
  }

  async function course(name: string, lessons: number, audience: object): Promise<string> {
    const id = (
      expectStatus(
        await admin.post('/courses', { title: `${name} ${unique}`, level: 'beginner' }),
        201,
      ).body as CourseSummary
    ).id;
    courses.push(id);
    expectStatus(
      await admin.put(`/courses/${id}/outline`, {
        modules: [
          {
            title: 'Basics',
            unlockRule: { type: 'always' },
            lessons: Array.from({ length: lessons }, (_, i) => ({
              title: `Part ${i + 1}`,
              type: 'article',
              content: { html: '<p>Hi</p>' },
            })),
          },
        ],
      }),
      200,
    );
    expectStatus(await admin.post(`/courses/${id}/publish`, audience), 201);
    return id;
  }

  async function batch(code: string): Promise<string> {
    return (
      expectStatus(
        await admin.post('/batches', {
          programId,
          code: `LIFE-${unique}-${code}`,
          name: `Lifecycle ${code}`,
          startDate: '2026-01-05',
          endDate: '2026-12-18',
        }),
        201,
      ).body as { id: string }
    ).id;
  }

  async function join(batch: string, ...people: Learner[]): Promise<void> {
    expectStatus(
      await admin.post(`/batches/${batch}/members`, { studentIds: people.map((p) => p.studentId) }),
      201,
    );
  }

  const enrolment = (studentId: string, courseId: string) =>
    prisma.enrollment.findUnique({ where: { studentId_courseId: { studentId, courseId } } });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    organizationId = (await prisma.organization.findFirstOrThrow()).id;
    admin = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);

    programId = (
      expectStatus(
        await admin.post('/programs', {
          code: `LIFE-${unique}`,
          name: `Lifecycle programme ${unique}`,
          durationWeeks: 24,
        }),
        201,
      ).body as { id: string }
    ).id;
    batchId = await batch('B1');
    leaver = await learner('leaver');
    stayer = await learner('stayer');
    await join(batchId, leaver, stayer);

    finishedId = await course('Finished course', 1, { scopeType: 'batch', scopeId: batchId });
    openId = await course('Open course', 2, { scopeType: 'batch', scopeId: batchId });
    await eventually(
      () => enrolment(leaver.studentId, openId),
      (row) => row !== null,
    );
    // The leaver finishes one course, starts the other, answers a question and attends a class.
    const lessons = await prisma.lesson.findMany({
      where: { module: { courseId: { in: [finishedId, openId] } }, title: 'Part 1' },
      select: { id: true },
    });
    for (const lesson of lessons) {
      expectStatus(await leaver.session.post(`/lessons/${lesson.id}/complete`), 201);
    }
    await eventually(
      () =>
        prisma.certificate.count({ where: { studentId: leaver.studentId, courseId: finishedId } }),
      (count) => count === 1,
    );

    const question = expectStatus(
      await admin.post('/questions', {
        title: `Lifecycle check ${unique}`,
        body: 'Pick the true one.',
        type: 'mcq_single',
        subject: 'javascript',
        difficulty: 'easy',
        marks: 1,
        options: [
          { body: 'True', isCorrect: true },
          { body: 'False', isCorrect: false },
        ],
      }),
      201,
    ).body as QuestionSummary;
    expectStatus(
      await admin.post(`/questions/${question.id}/status`, { status: 'published' }),
      201,
    );
    const assignment = expectStatus(
      await admin.post('/assignments', {
        title: `Lifecycle assignment ${unique}`,
        subject: 'javascript',
        difficulty: 'beginner',
        kind: 'mixed',
      }),
      201,
    ).body as { id: string };
    const structured = expectStatus(
      await admin.put(`/assignments/${assignment.id}/structure`, {
        modules: [
          {
            title: 'Only',
            unlockRule: { type: 'always' },
            questions: [{ questionId: question.id }],
          },
        ],
      }),
      200,
    ).body as { modules: { questions: { id: string }[] }[] };
    expectStatus(
      await admin.post(`/assignments/${assignment.id}/publish`, {
        batchId,
        opensAt: new Date(Date.now() - 60_000).toISOString(),
      }),
      201,
    );
    const placement = structured.modules[0]!.questions[0]!.id;
    const workspace = expectStatus(
      await leaver.session.get(`/me/assignments/${assignment.id}/questions/${placement}`),
      200,
    ).body as { question: { options: { id: string; body: string }[] } };
    expectStatus(
      await leaver.session.post(
        `/me/assignments/${assignment.id}/questions/${placement}/submissions`,
        { optionIds: [workspace.question.options.find((o) => o.body === 'True')!.id] },
      ),
      201,
    );

    const trainerId = (
      await prisma.trainerProfile.findFirstOrThrow({
        where: { user: { email: TEST_ACCOUNTS.trainer.email } },
      })
    ).id;
    // Late in the evening three days ago: clear of the timetables other specs give this trainer.
    const startsAt = new Date(Date.now() - 3 * 86_400_000);
    startsAt.setUTCHours(17, 0, 0, 0);
    const lesson = await prisma.liveSession.create({
      data: {
        batchId,
        trainerId,
        subject: 'Core Java',
        title: `Lifecycle class ${unique}`,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 3_600_000),
        status: 'completed',
      },
    });
    classId = lesson.id;
    expectStatus(
      await admin.put(`/sessions/${lesson.id}/attendance`, {
        records: [{ studentId: leaver.studentId, status: 'present' }],
      }),
      200,
    );
  });

  afterAll(async () => {
    for (const id of courses) await admin.delete(`/courses/${id}`);
    // The class was the shared test trainer's: leave their timetable as it was.
    if (classId) await prisma.liveSession.deleteMany({ where: { id: classId } });
    await app.close();
  });

  /** The leaver's record, counted: none of it may change with their account's state. */
  async function record() {
    const where = { studentId: leaver.studentId };
    return {
      lessons: await prisma.lessonProgress.count({ where: { ...where, status: 'completed' } }),
      submissions: await prisma.submission.count({ where }),
      attendance: await prisma.attendanceRecord.count({ where }),
      certificates: await prisma.certificate.count({ where: { ...where, status: 'issued' } }),
      enrolments: await prisma.enrollment.count({ where }),
    };
  }

  it('takes a deactivated learner out of their batch and courses, and keeps their record', async () => {
    const before = await record();
    expect(before).toMatchObject({ lessons: 2, submissions: 1, attendance: 1, certificates: 1 });
    const audits = await prisma.auditLog.count();

    expectStatus(
      await admin.post(`/users/${leaver.userId}/deactivate`, { reason: 'Left the institute' }),
      204,
    );

    // No way in, no place, no open course.
    expect((await leaver.session.get('/me/courses')).status).toBe(401);
    expect((await new Session(app).login(leaver.email, password)).status).not.toBe(200);
    expect(
      await prisma.batchMember.count({ where: { studentId: leaver.studentId, isActive: true } }),
    ).toBe(0);
    const ended = await prisma.batchMember.findFirstOrThrow({
      where: { studentId: leaver.studentId, batchId },
    });
    expect(ended.reason).toBe('Account deactivated');
    expect(
      await prisma.auditLog.count({
        where: {
          action: 'batches.member_removed',
          resourceId: batchId,
          summary: { contains: 'the account was deactivated' },
        },
      }),
    ).toBe(1);
    expect((await enrolment(leaver.studentId, openId))?.status).toBe('withdrawn');
    // A finished course is the learner's record (L4).
    expect((await enrolment(leaver.studentId, finishedId))?.status).toBe('completed');

    // The roster, a new course and the batch's notices pass them by; the stayer is unaffected.
    const roster = expectStatus(await admin.get(`/batches/${batchId}/members?pageSize=100`), 200)
      .body as { data: { studentId: string }[] };
    expect(roster.data.map((m) => m.studentId)).not.toContain(leaver.studentId);
    expect(roster.data.map((m) => m.studentId)).toContain(stayer.studentId);
    const later = await course('Later course', 1, { scopeType: 'batch', scopeId: batchId });
    expect(await enrolment(leaver.studentId, later)).toBeNull();
    expect((await enrolment(stayer.studentId, later))?.status).toBe('active');
    const notices = app.get(NotificationsService);
    const tag = `life-notice-${unique}`;
    await notices.deliverNow({
      category: 'batch',
      type: 'staff.broadcast',
      title: tag,
      body: '',
      channels: ['in_app'],
      audience: { roleKeys: [], batchIds: [batchId], programIds: [] },
    });
    await notices.deliverNow({
      category: 'account',
      type: 'staff.broadcast',
      title: tag,
      body: '',
      channels: ['in_app'],
      userIds: [leaver.userId, stayer.userId],
    });
    expect(await prisma.notification.count({ where: { userId: leaver.userId, title: tag } })).toBe(
      0,
    );
    expect(await prisma.notification.count({ where: { userId: stayer.userId, title: tag } })).toBe(
      2,
    );

    // Their record is whole, and the institute can still read it.
    expect(await record()).toEqual(before);
    expect(await prisma.auditLog.count()).toBeGreaterThan(audits);
    expectStatus(await admin.get(`/students/${leaver.studentId}`), 200);
    expectStatus(await admin.get(`/attendance/students/${leaver.studentId}`), 200);
    const certificate = await prisma.certificate.findFirstOrThrow({
      where: { studentId: leaver.studentId },
    });
    const verified = expectStatus(await admin.get(`/public/certificates/${certificate.code}`), 200)
      .body as { status: string };
    expect(verified.status).toBe('issued');
  });

  it('gives a reactivated learner their place and courses back', async () => {
    const before = await record();
    expectStatus(await admin.post(`/users/${leaver.userId}/reactivate`), 204);

    const place = await prisma.batchMember.findFirstOrThrow({
      where: { studentId: leaver.studentId, batchId, isActive: true },
    });
    expect(place.reason).toBe('Account reactivated');
    expect(
      await prisma.batchMember.count({ where: { studentId: leaver.studentId, batchId } }),
      'the gap stays on record: the old place is closed, the new one open',
    ).toBe(2);
    expect(
      await prisma.auditLog.count({
        where: { action: 'batches.members_added', summary: { contains: 'reactivated' } },
      }),
    ).toBeGreaterThan(0);

    const open = await enrolment(leaver.studentId, openId);
    expect(open?.status).toBe('active');
    expect(open?.progressPct).toBe(50);
    expect((await enrolment(leaver.studentId, finishedId))?.status).toBe('completed');
    const missed = courses[2]!;
    expect((await enrolment(leaver.studentId, missed))?.status).toBe('active');

    const back = new Session(app);
    expectStatus(await back.login(leaver.email, password), 200);
    expectStatus(await back.get(`/courses/${openId}`), 200);
    leaver.session = back;
    expect(await record()).toEqual({ ...before, enrolments: before.enrolments + 1 });
  });

  it('keeps a completed batch’s learners in their courses, and still gives it new ones', async () => {
    expectStatus(await admin.post(`/batches/${batchId}/status`, { status: 'running' }), 201);
    expectStatus(await admin.post(`/batches/${batchId}/status`, { status: 'completed' }), 201);
    expectStatus(await leaver.session.get(`/courses/${openId}`), 200);
    const alumni = await course('Alumni course', 1, { scopeType: 'batch', scopeId: batchId });
    expect((await enrolment(leaver.studentId, alumni))?.status).toBe('active');
  });

  it('ends what an archived batch gave, and keeps what was finished in it', async () => {
    expectStatus(await admin.post(`/batches/${batchId}/status`, { status: 'archived' }), 201);
    const open = await enrolment(leaver.studentId, openId);
    expect(open?.status).toBe('withdrawn');
    expect(open?.progressPct).toBe(50);
    expect((await leaver.session.get(`/courses/${openId}`)).status).toBe(403);
    expect((await enrolment(leaver.studentId, finishedId))?.status).toBe('completed');
    expectStatus(await leaver.session.get(`/courses/${finishedId}`), 200);
    expect(
      await prisma.certificate.count({ where: { studentId: leaver.studentId, status: 'issued' } }),
    ).toBe(1);
    // Nothing new reaches an archived batch.
    const refused = await admin.post(`/courses/${finishedId}/publish`, {
      scopeType: 'batch',
      scopeId: batchId,
    });
    expect(refused.status).toBe(422);
    expect(problemCode(refused)).toBe('audience_archived');
  });

  it('neither completes nor certifies a course whose access has ended', async () => {
    // The open course is withdrawn (the batch is archived) at 50%. Its last part done anyway — a
    // lab passed elsewhere, a lesson removed — moves the figure but not the status.
    const last = await prisma.lesson.findFirstOrThrow({
      where: { module: { courseId: openId }, title: 'Part 2' },
    });
    await prisma.lessonProgress.create({
      data: {
        studentId: leaver.studentId,
        lessonId: last.id,
        status: 'completed',
        completedAt: new Date(),
      },
    });
    expect(await app.get(ProgressService).recomputeCourse(leaver.studentId, openId)).toBe(100);
    const row = await enrolment(leaver.studentId, openId);
    expect(row?.status).toBe('withdrawn');
    expect(row?.completedAt).toBeNull();
    expect(
      await prisma.certificate.count({ where: { studentId: leaver.studentId, courseId: openId } }),
    ).toBe(0);
  });

  it('ends and restores what a programme gives as the programme is archived and reopened', async () => {
    const second = await batch('B2');
    const newcomer = await learner('newcomer');
    await join(second, newcomer);
    expectStatus(await admin.post(`/batches/${second}/status`, { status: 'running' }), 201);
    expectStatus(await admin.post(`/batches/${second}/status`, { status: 'completed' }), 201);
    const wide = await course('Programme course', 1, { scopeType: 'program', scopeId: programId });
    expect((await enrolment(newcomer.studentId, wide))?.status).toBe('active');
    // Through the archived first batch, the programme reaches nobody.
    expect(await enrolment(leaver.studentId, wide)).toBeNull();

    expectStatus(await admin.patch(`/programs/${programId}`, { status: 'archived' }), 200);
    expect((await enrolment(newcomer.studentId, wide))?.status).toBe('withdrawn');
    expect((await newcomer.session.get(`/courses/${wide}`)).status).toBe(403);
    const refused = await admin.post(`/courses/${openId}/publish`, {
      scopeType: 'program',
      scopeId: programId,
    });
    expect(refused.status).toBe(422);
    expect(problemCode(refused)).toBe('audience_archived');

    expectStatus(await admin.patch(`/programs/${programId}`, { status: 'active' }), 200);
    expect((await enrolment(newcomer.studentId, wide))?.status).toBe('active');
    expectStatus(await newcomer.session.get(`/courses/${wide}`), 200);
  });
});
