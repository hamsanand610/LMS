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
import { Session, expectStatus } from './setup/http.js';
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
    return { session, studentId: profile.id, studentCode: profile.studentCode };
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

    // The old batch's trainer no longer reaches the learner, by page or by search.
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
    expect(
      await prisma.auditLog.count({
        where: { action: 'batches.member_transferred', resourceId: batchId },
      }),
    ).toBeGreaterThan(0);
  });
});
