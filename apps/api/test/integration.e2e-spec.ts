import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  SYSTEM_ROLES,
  type CourseProgress,
  type CourseSummary,
  type ProgressOverview,
  type SearchResponse,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp } from './setup/app.js';
import { eventually } from './setup/eventually.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

/**
 * Phase 5: the modules as one LMS. One learner is followed through a course published to their
 * batch — reached, found, completed, certified — and then moved to another batch, and every side
 * (the learner, the trainer of each batch, the administrator, search) is asked what it sees.
 */
describe('cross-module integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let trainer: Session;
  let learner: Session;
  let outsider: Session;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  const title = `Integration course ${unique}`;

  let organizationId = '';
  let batchId = '';
  let otherBatchId = '';
  let courseId = '';
  let lessonId = '';
  let studentId = '';
  let studentCode = '';
  let doubtId = '';

  async function account(label: string, inBatch: string) {
    const role = await prisma.role.findFirstOrThrow({
      where: { organizationId, key: SYSTEM_ROLES.STUDENT },
    });
    const email = `int-${label}-${unique}@test.local`;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `Integration ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
      },
    });
    const profile = await prisma.studentProfile.create({
      data: { userId: user.id, studentCode: `STU-INT-${label}-${unique}`, status: 'active' },
    });
    await prisma.batchMember.create({ data: { batchId: inBatch, studentId: profile.id } });
    const session = new Session(app);
    expectStatus(await session.login(email, password), 200);
    return { session, studentId: profile.id, studentCode: profile.studentCode, userId: user.id };
  }

  const hits = (response: SearchResponse, type: string) =>
    response.groups.find((g) => g.type === type)?.hits ?? [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    organizationId = (await prisma.organization.findFirstOrThrow()).id;
    batchId = (
      await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.assignedBatchCode } })
    ).id;
    otherBatchId = (
      await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.otherBatchCode } })
    ).id;
    admin = new Session(app);
    trainer = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    expectStatus(await trainer.login(TEST_ACCOUNTS.trainer.email, password), 200);
    const mine = await account('learner', batchId);
    learner = mine.session;
    studentId = mine.studentId;
    studentCode = mine.studentCode;
    outsider = (await account('outsider', otherBatchId)).session;

    // A course given to the trainer's batch, after the learner joined it.
    courseId = (
      expectStatus(
        await admin.post('/courses', { title, level: 'beginner', subject: 'core-java' }),
        201,
      ).body as CourseSummary
    ).id;
    expectStatus(
      await admin.put(`/courses/${courseId}/outline`, {
        modules: [
          {
            title: 'Basics',
            unlockRule: { type: 'always' },
            lessons: [{ title: 'Read me', type: 'article', content: { html: '<p>Hello</p>' } }],
          },
        ],
      }),
      200,
    );
    lessonId = (await prisma.lesson.findFirstOrThrow({ where: { module: { courseId } } })).id;
    expectStatus(
      await admin.post(`/courses/${courseId}/publish`, { scopeType: 'batch', scopeId: batchId }),
      201,
    );
  });

  afterAll(async () => {
    await prisma.certificate.deleteMany({ where: { courseId } });
    await prisma.doubt.deleteMany({ where: { id: doubtId } });
    if (courseId) expectStatus(await admin.delete(`/courses/${courseId}`), 200);
    await prisma.batchMember.updateMany({
      where: { student: { studentCode: { contains: `-${unique}` } } },
      data: { isActive: false, leftAt: new Date() },
    });
    await app.close();
  });

  it('reaches the batch’s learner and trainer, and nobody else, and search agrees', async () => {
    const courses = expectStatus(await learner.get('/me/courses'), 200).body as CourseProgress[];
    expect(courses.map((c) => c.courseId)).toContain(courseId);
    expectStatus(await learner.get(`/courses/${courseId}`), 200);
    const forLearner = expectStatus(
      await learner.get(`/search?q=${encodeURIComponent(title)}`),
      200,
    ).body as SearchResponse;
    expect(hits(forLearner, 'course').map((h) => h.route)).toEqual([`/courses/${courseId}`]);

    // The learner of another batch neither opens it nor finds it.
    expect((await outsider.get(`/courses/${courseId}`)).status).toBe(403);
    const forOutsider = expectStatus(
      await outsider.get(`/search?q=${encodeURIComponent(title)}`),
      200,
    ).body as SearchResponse;
    expect(hits(forOutsider, 'course')).toHaveLength(0);

    // Staff find it in their own portal, and the trainer finds the learner there too.
    const forTrainer = expectStatus(
      await trainer.get(`/search?q=${encodeURIComponent(title)}`),
      200,
    ).body as SearchResponse;
    expect(hits(forTrainer, 'course').map((h) => h.route)).toEqual([
      `/trainer/courses/${courseId}`,
    ]);
    const learnerForTrainer = expectStatus(await trainer.get(`/search?q=${studentCode}`), 200)
      .body as SearchResponse;
    expect(hits(learnerForTrainer, 'student').map((h) => h.route)).toEqual([
      `/trainer/students/${studentId}`,
    ]);
    const forAdmin = expectStatus(await admin.get(`/search?q=${encodeURIComponent(title)}`), 200)
      .body as SearchResponse;
    expect(hits(forAdmin, 'course').map((h) => h.route)).toEqual([`/admin/courses/${courseId}`]);
  });

  it('finds staff only the assignments and tests their own lists show them', async () => {
    const hidden = `Unreached work ${unique}`;
    const assignment = expectStatus(
      await admin.post('/assignments', {
        title: hidden,
        subject: 'core-java',
        settings: {
          attemptsPerQuestion: 1,
          explanationPolicy: 'never',
          duePolicy: 'allow_late',
          gradingMethod: 'best',
        },
      }),
      201,
    ).body as { id: string };
    const test = expectStatus(
      await admin.post('/tests', { title: hidden, kind: 'weekly', subject: 'core-java' }),
      201,
    ).body as { id: string };
    try {
      const forTrainer = expectStatus(
        await trainer.get(`/search?q=${encodeURIComponent(hidden)}`),
        200,
      ).body as SearchResponse;
      expect(hits(forTrainer, 'assignment')).toHaveLength(0);
      expect(hits(forTrainer, 'test')).toHaveLength(0);
      expect((await trainer.get(`/assignments/${assignment.id}`)).status).toBe(403);
      const forAdmin = expectStatus(await admin.get(`/search?q=${encodeURIComponent(hidden)}`), 200)
        .body as SearchResponse;
      expect(hits(forAdmin, 'assignment').map((h) => h.route)).toEqual([
        `/admin/assignments/${assignment.id}`,
      ]);
      expect(hits(forAdmin, 'test').map((h) => h.route)).toEqual([`/admin/tests/${test.id}`]);
      const forLearner = expectStatus(
        await learner.get(`/search?q=${encodeURIComponent(hidden)}`),
        200,
      ).body as SearchResponse;
      expect(forLearner.total).toBe(0);
    } finally {
      await prisma.assignment.delete({ where: { id: assignment.id } });
      await prisma.test.delete({ where: { id: test.id } });
    }
  });

  it('takes a doubt to the batch’s trainer and the answer back, read once it is opened', async () => {
    doubtId = (
      expectStatus(
        await learner.post('/me/doubts', {
          title: `Stuck on the lesson ${unique}`,
          body: 'What does the first paragraph mean?',
          courseId,
        }),
        201,
      ).body as { id: string }
    ).id;
    const queue = expectStatus(await trainer.get('/doubts?pageSize=100'), 200).body as {
      data: { id: string }[];
    };
    expect(queue.data.map((d) => d.id)).toContain(doubtId);
    expect((await outsider.get(`/me/doubts/${doubtId}`)).status).toBe(404);
    expectStatus(await trainer.post(`/doubts/${doubtId}/replies`, { body: 'It says hello.' }), 201);
    const unread = () =>
      prisma.notification.count({
        where: {
          user: { studentProfile: { id: studentId } },
          link: `/doubts/${doubtId}`,
          readAt: null,
        },
      });
    expect(await unread()).toBe(1);
    // Reading the thread reads its notice; the bell does not keep it waiting.
    expectStatus(await learner.get(`/me/doubts/${doubtId}`), 200);
    expect(await unread()).toBe(0);
  });

  it('carries a completed lesson to the course, the certificate and the trainer’s view', async () => {
    const done = await learner.post(`/lessons/${lessonId}/complete`);
    expect([200, 201]).toContain(done.status);
    const enrolment = await prisma.enrollment.findFirstOrThrow({ where: { studentId, courseId } });
    expect(enrolment.status).toBe('completed');
    expect(enrolment.progressPct).toBe(100);
    // Issued by the course.completed event's job, just after the response.
    const issued = await eventually(
      () => prisma.certificate.count({ where: { studentId, courseId, status: 'issued' } }),
      (count) => count === 1,
    );
    expect(issued).toBe(1);
    const seen = expectStatus(await trainer.get(`/students/${studentId}/progress`), 200)
      .body as ProgressOverview;
    expect(seen.courses.find((c) => c.courseId === courseId)?.completedLessons).toBe(1);
  });

  it('gives the learner, the trainer and the report one attendance figure', async () => {
    const attendee = await account('attendee', batchId);
    const trainerId = (
      await prisma.trainerProfile.findFirstOrThrow({
        where: { user: { email: TEST_ACCOUNTS.trainer.email } },
      })
    ).id;
    const sessions = [];
    for (const daysAgo of [2, 1]) {
      const startsAt = new Date(Date.now() - daysAgo * 24 * 3_600_000);
      sessions.push(
        await prisma.liveSession.create({
          data: {
            batchId,
            trainerId,
            subject: 'Core Java',
            title: `Integration class ${daysAgo} ${unique}`,
            startsAt,
            endsAt: new Date(startsAt.getTime() + 3_600_000),
            status: 'completed',
          },
        }),
      );
    }
    try {
      // The trainer takes both roll calls: present at one, absent at the other.
      for (const [index, status] of (['present', 'absent'] as const).entries()) {
        expectStatus(
          await trainer.put(`/sessions/${sessions[index]!.id}/attendance`, {
            records: [{ studentId: attendee.studentId, status }],
          }),
          200,
        );
      }
      const own = expectStatus(await attendee.session.get('/me/attendance'), 200).body as {
        summary: { conducted: number; percentage: number | null };
      };
      const forTrainer = expectStatus(
        await trainer.get(`/attendance/students/${attendee.studentId}`),
        200,
      ).body as { summary: { conducted: number; percentage: number | null } };
      const report = expectStatus(
        await admin.get(`/reports/attendance?q=${attendee.studentCode}`),
        200,
      ).body as { rows: { studentCode?: unknown; conducted?: unknown; percentage?: unknown }[] };
      const row = report.rows.find((r) => r.studentCode === attendee.studentCode);
      expect(own.summary).toMatchObject({ conducted: 2, percentage: 50 });
      expect(forTrainer.summary).toMatchObject({ conducted: 2, percentage: 50 });
      expect(row).toMatchObject({ conducted: 2, percentage: 50 });
    } finally {
      await prisma.liveSession.deleteMany({ where: { id: { in: sessions.map((s) => s.id) } } });
    }
  });

  it('gives nothing new to an archived batch', async () => {
    const assigned = await prisma.batch.findUniqueOrThrow({ where: { id: batchId } });
    const archived = await prisma.batch.create({
      data: {
        organizationId,
        programId: assigned.programId,
        code: `ARC-${unique}`,
        name: `Archived batch ${unique}`,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-06-30'),
        status: 'archived',
      },
    });
    try {
      const refused = [
        await admin.post(`/courses/${courseId}/publish`, {
          scopeType: 'batch',
          scopeId: archived.id,
        }),
        await admin.post('/announcements', {
          title: `To history ${unique}`,
          body: 'Nobody should get this.',
          audience: { batchIds: [archived.id] },
          startsAt: new Date().toISOString(),
        }),
        await admin.post('/feedback/forms', {
          title: `Old cohort ${unique}`,
          batchId: archived.id,
          opensAt: new Date().toISOString(),
          closesAt: new Date(Date.now() + 86_400_000).toISOString(),
          questions: [{ id: 'pace', kind: 'rating', prompt: 'How was the pace?' }],
        }),
      ];
      for (const response of refused) {
        expect(response.status).toBe(422);
        expect(problemCode(response)).toBe('audience_archived');
      }
      expect(
        await prisma.coursePublication.count({ where: { courseId, scopeId: archived.id } }),
      ).toBe(0);
    } finally {
      await prisma.batch.update({ where: { id: archived.id }, data: { deletedAt: new Date() } });
    }
  });

  it('ends the batch places of someone who is no longer a learner, and only theirs', async () => {
    const leaving = await account('leaving', batchId);
    const staying = await account('staying', batchId);
    // The learner role taken away: their places end, recorded as any removal is.
    expectStatus(await admin.put(`/users/${leaving.userId}/roles`, { roleKeys: ['trainer'] }), 200);
    expect(
      await prisma.batchMember.count({ where: { studentId: leaving.studentId, isActive: true } }),
    ).toBe(0);
    expect(
      await prisma.auditLog.count({
        where: {
          action: 'batches.member_removed',
          summary: { contains: 'learner role was removed' },
        },
      }),
    ).toBeGreaterThan(0);
    // A role added beside the learner role changes nothing about the batch.
    expectStatus(
      await admin.put(`/users/${staying.userId}/roles`, { roleKeys: ['student', 'trainer'] }),
      200,
    );
    expect(
      await prisma.batchMember.count({ where: { studentId: staying.studentId, isActive: true } }),
    ).toBe(1);
  });

  it('moves what the learner reaches, and who sees them, when they change batch', async () => {
    expectStatus(
      await admin.post(`/batches/${batchId}/members/transfer`, {
        studentId,
        toBatchId: otherBatchId,
        reason: 'Moved to the evening batch',
      }),
      204,
    );
    // The course reached them only through the old batch: access ends, the record stays (D4).
    // The withdrawal follows the batch.members_changed event, just after the response.
    const enrolment = await eventually(
      () => prisma.enrollment.findFirstOrThrow({ where: { studentId, courseId } }),
      (row) => row.status === 'withdrawn',
    );
    expect((await learner.get(`/courses/${courseId}`)).status).toBe(403);
    expect(enrolment.status).toBe('withdrawn');
    expect(enrolment.completedAt).not.toBeNull();
    expect(
      await prisma.certificate.count({ where: { studentId, courseId, status: 'issued' } }),
    ).toBe(1);

    // The old batch's trainer no longer reaches the learner — not their page, their doubt, or a
    // search — while the administrator still does.
    const queue = expectStatus(await trainer.get('/doubts?pageSize=100'), 200).body as {
      data: { id: string }[];
    };
    expect(queue.data.map((d) => d.id)).not.toContain(doubtId);
    expect([403, 404]).toContain((await trainer.get(`/doubts/${doubtId}`)).status);
    expectStatus(await admin.get(`/doubts/${doubtId}`), 200);
    expect([403, 404]).toContain((await trainer.get(`/students/${studentId}`)).status);
    const search = expectStatus(await trainer.get(`/search?q=${studentCode}`), 200)
      .body as SearchResponse;
    expect(hits(search, 'student')).toHaveLength(0);
    // The administrator finds them in the new batch.
    const forAdmin = expectStatus(await admin.get(`/search?q=${studentCode}`), 200)
      .body as SearchResponse;
    expect(hits(forAdmin, 'student').map((h) => h.route)).toEqual([`/admin/students/${studentId}`]);
    expect(
      await prisma.batchMember.count({
        where: { studentId, batchId: otherBatchId, isActive: true },
      }),
    ).toBe(1);

    // The withdrawn course leaves the new batch's figures, and stays listed, marked, in the report.
    const dashboard = expectStatus(
      await admin.get(`/reports/dashboard?batchId=${otherBatchId}`),
      200,
    ).body as { courses: { id: string }[] };
    expect(dashboard.courses.map((c) => c.id)).not.toContain(courseId);
    const report = expectStatus(await admin.get(`/reports/progress?q=${studentCode}`), 200)
      .body as {
      rows: { course?: unknown; status?: unknown }[];
      summary: { key: string; value: number | null }[];
    };
    expect(report.rows.find((r) => r.course === title)?.status).toBe('withdrawn');
    expect(report.summary.find((t) => t.key === 'enrolments')?.value).toBe(0);
    expect(
      await prisma.auditLog.count({
        where: { action: 'batches.member_transferred', resourceId: batchId },
      }),
    ).toBeGreaterThan(0);
  });
});
