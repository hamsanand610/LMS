import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  SYSTEM_ROLES,
  type CourseEnrollmentRow,
  type CourseSummary,
  type Paginated,
  type PublicationRecord,
  type StaffCertificateRecord,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

/**
 * Phase 4: administration and operations (ADM-01 to ADM-10), each checked from the side that may
 * act and from the side that must be refused.
 */
describe('administration and operations', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: Session;
  let admin: Session;
  let trainer: Session;
  let student: Session;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);

  let organizationId = '';
  let batchId = '';

  async function learner(label: string) {
    const role = await prisma.role.findFirstOrThrow({
      where: { organizationId, key: SYSTEM_ROLES.STUDENT },
    });
    const email = `ops-${label}-${unique}@test.local`;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `Ops ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
      },
    });
    const profile = await prisma.studentProfile.create({
      data: { userId: user.id, studentCode: `STU-OPS-${label}-${unique}`, status: 'active' },
    });
    return { email, userId: user.id, studentId: profile.id };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    organizationId = (await prisma.organization.findFirstOrThrow()).id;
    superAdmin = new Session(app);
    admin = new Session(app);
    trainer = new Session(app);
    expectStatus(await superAdmin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    expectStatus(await admin.login(TEST_ACCOUNTS.admin.email, password), 200);
    expectStatus(await trainer.login(TEST_ACCOUNTS.trainer.email, password), 200);
    student = new Session(app);
    expectStatus(await student.login(TEST_ACCOUNTS.student.email, password), 200);
    batchId = (
      await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.assignedBatchCode } })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ───────────────────────── ADM-04 / D8: enrolment ─────────────────────────

  describe('a learner enrolled on their own', () => {
    let courseId = '';
    let solo: Awaited<ReturnType<typeof learner>>;
    let publicationId = '';

    beforeAll(async () => {
      solo = await learner('solo');
      courseId = (
        expectStatus(
          await admin.post('/courses', {
            title: `Solo course ${unique}`,
            level: 'beginner',
            subject: 'core-java',
          }),
          201,
        ).body as CourseSummary
      ).id;
      expectStatus(
        await admin.put(`/courses/${courseId}/outline`, {
          modules: [
            {
              title: 'One',
              unlockRule: { type: 'always' },
              lessons: [{ title: 'Hello', type: 'article', content: { html: '<p>Hi</p>' } }],
            },
          ],
        }),
        200,
      );
    });

    afterAll(async () => {
      expectStatus(await admin.delete(`/courses/${courseId}`), 200);
    });

    it('is a publication to that learner, and only an administrator makes one', async () => {
      const refused = await trainer.post(`/courses/${courseId}/publish`, {
        scopeType: 'learner',
        scopeId: solo.studentId,
      });
      expect(refused.status).toBe(403);
      const unknown = await admin.post(`/courses/${courseId}/publish`, {
        scopeType: 'learner',
        scopeId: '00000000-0000-4000-8000-000000000000',
      });
      expect(unknown.status).toBe(404);
      const publication = expectStatus(
        await admin.post(`/courses/${courseId}/publish`, {
          scopeType: 'learner',
          scopeId: solo.studentId,
        }),
        201,
      ).body as PublicationRecord;
      publicationId = publication.id;
      expect(publication.enrolled).toBe(1);
      expect(publication.scopeLabel).toContain('on their own');
      const session = new Session(app);
      expectStatus(await session.login(solo.email, password), 200);
      expectStatus(await session.get(`/courses/${courseId}`), 200);
    });

    it('is listed with the course’s enrolments, for administrators', async () => {
      const list = expectStatus(await admin.get(`/courses/${courseId}/enrollments`), 200)
        .body as Paginated<CourseEnrollmentRow>;
      expect(list.data).toEqual([
        expect.objectContaining({
          studentId: solo.studentId,
          source: 'learner',
          individualPublicationId: publicationId,
        }),
      ]);
      expect((await trainer.get(`/courses/${courseId}/enrollments`)).status).toBe(403);
    });

    it('survives the learner’s batches changing, and goes when withdrawn', async () => {
      await prisma.batchMember.create({ data: { batchId, studentId: solo.studentId } });
      expectStatus(
        await admin.delete(`/batches/${batchId}/members/${solo.studentId}?reason=Moving%20on`),
        204,
      );
      const kept = await prisma.enrollment.findFirstOrThrow({
        where: { courseId, studentId: solo.studentId },
      });
      expect(kept.status).toBe('active');
      expectStatus(await admin.delete(`/courses/${courseId}/publications/${publicationId}`), 200);
      expect(
        await prisma.enrollment.count({ where: { courseId, studentId: solo.studentId } }),
      ).toBe(0);
    });
  });

  // ───────────────────────── ADM-05 / D9: certificates ─────────────────────────

  describe('a certificate administered', () => {
    let certificateId = '';
    const code = `T${unique}ZZZZZ`;

    beforeAll(async () => {
      const profile = await prisma.studentProfile.findFirstOrThrow({
        where: { user: { email: TEST_ACCOUNTS.student.email } },
        include: { user: true },
      });
      const course = await prisma.course.findFirstOrThrow({ where: { deletedAt: null } });
      certificateId = (
        await prisma.certificate.create({
          data: {
            organizationId,
            studentId: profile.id,
            courseId: course.id,
            code,
            learnerName: profile.user.name,
            courseTitle: `Certified ${unique}`,
            institute: 'SI Academy',
            completedAt: new Date(),
          },
        })
      ).id;
    });

    afterAll(async () => {
      await prisma.certificate.delete({ where: { id: certificateId } });
    });

    it('is listed for staff by scope, and changed by administrators only', async () => {
      const mine = expectStatus(await trainer.get(`/certificates?q=${code}`), 200)
        .body as Paginated<StaffCertificateRecord>;
      expect(mine.data.map((c) => c.id)).toContain(certificateId);
      expect(
        (await trainer.post(`/certificates/${certificateId}/revoke`, { reason: 'No' })).status,
      ).toBe(403);
      expect((await student.get('/certificates')).status).toBe(403);
    });

    it('is revoked with a reason: the check says so, nothing downloads, the learner is told', async () => {
      expect(
        (await admin.post(`/certificates/${certificateId}/revoke`, { reason: '' })).status,
      ).toBe(400);
      const revoked = expectStatus(
        await admin.post(`/certificates/${certificateId}/revoke`, {
          reason: 'Issued against the wrong course',
        }),
        200,
      ).body as StaffCertificateRecord;
      expect(revoked.status).toBe('revoked');
      expect(revoked.revokedReason).toBe('Issued against the wrong course');
      const check = expectStatus(await new Session(app).get(`/public/certificates/${code}`), 200)
        .body as { status: string };
      expect(check.status).toBe('revoked');
      expect((await student.get(`/me/certificates/${certificateId}/download`)).status).toBe(422);
      const learnerUser = await prisma.user.findUniqueOrThrow({
        where: { email: TEST_ACCOUNTS.student.email },
      });
      expect(
        await prisma.notification.count({
          where: {
            userId: learnerUser.id,
            type: 'certificate.status',
            title: { contains: unique },
          },
        }),
      ).toBe(1);
      expect(
        await prisma.auditLog.count({
          where: { action: 'certificate.revoked', resourceId: certificateId },
        }),
      ).toBe(1);
    });

    it('is reinstated as it was issued, and its PDF can be drawn again', async () => {
      const back = expectStatus(
        await admin.post(`/certificates/${certificateId}/reinstate`, {
          reason: 'Checked: the course was right',
        }),
        200,
      ).body as StaffCertificateRecord;
      expect(back.status).toBe('issued');
      expect(back.courseTitle, 'the words stay as issued').toBe(`Certified ${unique}`);
      expectStatus(await admin.post(`/certificates/${certificateId}/redraw`), 200);
      const stored = await prisma.certificate.findUniqueOrThrow({ where: { id: certificateId } });
      expect(stored.objectKey).toContain(certificateId);
    });
  });
});
