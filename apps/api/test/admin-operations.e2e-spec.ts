import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  SYSTEM_ROLES,
  type AnnouncementItem,
  type CourseEnrollmentRow,
  type CourseSummary,
  type Paginated,
  type PublicationRecord,
  type ReportCatalogue,
  type ReportData,
  type ExportJobRecord,
  type StaffCertificateRecord,
  ERASED_LEARNER_NAME,
  type LearnerDataExport,
  type PrivacyErasureResult,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../src/core/storage/storage.driver.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { CertificatesService } from '../src/modules/certificates/certificates.service.js';
import { RetentionService } from '../src/modules/health/retention.service.js';
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
    let courseId = '';
    const code = `T${unique}ZZZZZ`;

    beforeAll(async () => {
      const profile = await prisma.studentProfile.findFirstOrThrow({
        where: { user: { email: TEST_ACCOUNTS.student.email } },
        include: { user: true },
      });
      // A course of its own: other specs may already have certified this learner elsewhere.
      courseId = (
        expectStatus(
          await admin.post('/courses', {
            title: `Certified ${unique}`,
            level: 'beginner',
            subject: 'core-java',
          }),
          201,
        ).body as CourseSummary
      ).id;
      certificateId = (
        await prisma.certificate.create({
          data: {
            organizationId,
            studentId: profile.id,
            courseId,
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
      if (certificateId) await prisma.certificate.delete({ where: { id: certificateId } });
      if (courseId) expectStatus(await admin.delete(`/courses/${courseId}`), 200);
    });

    it('is listed for staff by scope, and changed by administrators only', async () => {
      const all = expectStatus(await admin.get(`/certificates?q=${code}`), 200)
        .body as Paginated<StaffCertificateRecord>;
      expect(all.data.map((c) => c.id)).toContain(certificateId);
      // Its course was never given to the trainer's batches, so it is not theirs to see (D6); the
      // staff-scope spec shows a trainer the certificates of their batches' courses.
      const mine = expectStatus(await trainer.get(`/certificates?q=${code}`), 200)
        .body as Paginated<StaffCertificateRecord>;
      expect(mine.data.map((c) => c.id)).not.toContain(certificateId);
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

  // ───────────────────────── ADM-01: users ─────────────────────────

  describe('a user administered', () => {
    it('comes with the learner or trainer record their role needs', async () => {
      const asTrainer = expectStatus(
        await admin.post('/users', {
          name: 'Profiled Trainer',
          email: `profiled-trainer-${unique}@test.local`,
          roleKeys: [SYSTEM_ROLES.TRAINER],
        }),
        201,
      ).body as { id: string };
      expect(await prisma.trainerProfile.count({ where: { userId: asTrainer.id } })).toBe(1);
      const asLearner = expectStatus(
        await admin.post('/users', {
          name: 'Profiled Learner',
          email: `profiled-learner-${unique}@test.local`,
          roleKeys: [SYSTEM_ROLES.STUDENT],
        }),
        201,
      ).body as { id: string };
      const profile = await prisma.studentProfile.findUniqueOrThrow({
        where: { userId: asLearner.id },
      });
      expect(profile.studentCode).toMatch(/^STU-/);
      // A role added later brings its record too.
      expectStatus(
        await admin.put(`/users/${asTrainer.id}/roles`, {
          roleKeys: [SYSTEM_ROLES.TRAINER, SYSTEM_ROLES.STUDENT],
        }),
        200,
      );
      expect(await prisma.studentProfile.count({ where: { userId: asTrainer.id } })).toBe(1);
    });

    it('is unlocked by an administrator, and by nobody without the permission', async () => {
      const locked = await learner('locked');
      await prisma.user.update({
        where: { id: locked.userId },
        data: { failedLoginCount: 5, lockedUntil: new Date(Date.now() + 3_600_000) },
      });
      const listed = expectStatus(await admin.get(`/users?q=ops-locked-${unique}`), 200)
        .body as Paginated<{ id: string; lockedUntil: string | null }>;
      expect(listed.data.find((u) => u.id === locked.userId)?.lockedUntil).not.toBeNull();
      expect((await trainer.post(`/users/${locked.userId}/unlock`)).status).toBe(403);
      expectStatus(await admin.post(`/users/${locked.userId}/unlock`), 200);
      const after = await prisma.user.findUniqueOrThrow({ where: { id: locked.userId } });
      expect(after.lockedUntil).toBeNull();
      expect(after.failedLoginCount).toBe(0);
      const session = new Session(app);
      expectStatus(await session.login(locked.email, password), 200);
    });

    it('shows a person’s sessions and ends them, one or all', async () => {
      const person = await learner('sessions');
      for (let i = 0; i < 2; i += 1) {
        expectStatus(await new Session(app).login(person.email, password), 200);
      }
      const sessions = expectStatus(await admin.get(`/users/${person.userId}/sessions`), 200)
        .body as { id: string }[];
      expect(sessions.length).toBe(2);
      expectStatus(await admin.delete(`/users/${person.userId}/sessions/${sessions[0]!.id}`), 204);
      expectStatus(await admin.delete(`/users/${person.userId}/sessions`), 204);
      expect(
        await prisma.session.count({ where: { userId: person.userId, revokedAt: null } }),
      ).toBe(0);
      expect(
        await prisma.auditLog.count({
          where: { action: 'users.signed_out_everywhere', resourceId: person.userId },
        }),
      ).toBe(1);
      const owner = await prisma.user.findUniqueOrThrow({
        where: { email: TEST_ACCOUNTS.superAdmin.email },
      });
      expect((await admin.get(`/users/${owner.id}/sessions`)).status).toBe(403);
    });
  });

  // ───────────────────────── ADM-10: failed jobs ─────────────────────────

  describe('failed background jobs', () => {
    it('are listed and retried by the Super Admin only', async () => {
      expectStatus(await superAdmin.get('/admin/jobs/failed'), 200);
      expect((await admin.get('/admin/jobs/failed')).status).toBe(403);
      expect((await admin.post('/admin/jobs/x:1/retry')).status).toBe(403);
      expect((await superAdmin.post('/admin/jobs/not-a-job/retry')).status).toBe(400);
    });
  });

  // ───────────────────────── ADM-06: reports ─────────────────────────

  describe('the reports', () => {
    it('are offered to those who may read their rows', async () => {
      const forAdmin = expectStatus(await admin.get('/reports'), 200).body as ReportCatalogue;
      expect(forAdmin.reports.map((r) => r.name)).toEqual(
        expect.arrayContaining(['certificates', 'placements', 'feedback', 'trainers']),
      );
      expect(forAdmin.pending.map((r) => r.name)).toEqual(['projects']);
      const forTrainer = expectStatus(await trainer.get('/reports'), 200).body as ReportCatalogue;
      expect(forTrainer.reports.map((r) => r.name)).not.toContain('placements');
      expect((await trainer.get('/reports/placements')).status).toBe(403);
      expectStatus(await admin.get('/reports/placements'), 200);
      expectStatus(await admin.get('/reports/certificates'), 200);
      expectStatus(await trainer.get('/reports/feedback'), 200);
    });

    it('show a trainer their own performance row, and administrators every trainer', async () => {
      const all = expectStatus(await admin.get('/reports/trainers?pageSize=200'), 200)
        .body as ReportData;
      expect(all.meta.total).toBeGreaterThan(1);
      const own = expectStatus(await trainer.get('/reports/trainers'), 200).body as ReportData;
      expect(own.rows.map((r) => r.trainer)).toEqual([TEST_ACCOUNTS.trainer.name]);
    });

    it('export like any other report', async () => {
      const job = expectStatus(
        await admin.post('/exports', { report: 'trainers', format: 'csv', params: {} }),
        201,
      ).body as ExportJobRecord;
      const finished = expectStatus(await admin.get(`/exports/${job.id}`), 200)
        .body as ExportJobRecord;
      expect(finished.status).toBe('ready');
    });
  });

  // ───────────────────────── ADM-07: placement ─────────────────────────

  describe('a placement drive’s applicants', () => {
    let driveId = '';
    let applicationId = '';
    let applicantCode = '';

    beforeAll(async () => {
      const applicant = await learner('applicant');
      applicantCode = `STU-OPS-applicant-${unique}`;
      const company = await prisma.company.create({
        data: { organizationId, slug: `acme-${unique}`, name: `Acme ${unique}` },
      });
      driveId = (
        await prisma.placementDrive.create({
          data: {
            organizationId,
            companyId: company.id,
            code: `DRV-${unique}`,
            role: `Backend developer ${unique}`,
            applyBy: new Date(Date.now() + 7 * 86_400_000),
            status: 'open',
          },
        })
      ).id;
      const key = `test/ops/${unique}/resume.pdf`;
      const file = await prisma.file.create({
        data: {
          organizationId,
          ownerType: 'resume',
          uploadedById: applicant.userId,
          driver: 's3',
          bucket: 'lms-private',
          key,
          originalName: 'resume.pdf',
          mime: 'application/pdf',
          size: 20,
          visibility: 'private',
          status: 'ready',
        },
      });
      await app
        .get<StorageDriver>(STORAGE_DRIVER)
        .put('private', key, new TextEncoder().encode('%PDF-1.7\n% resume\n'), 'application/pdf');
      const resume = await prisma.resume.create({
        data: { studentId: applicant.studentId, fileId: file.id, title: 'My resume' },
      });
      applicationId = (
        await prisma.driveApplication.create({
          data: { driveId, studentId: applicant.studentId, resumeId: resume.id },
        })
      ).id;
    });

    it('opens an applicant’s resume for placement staff, and records it', async () => {
      const link = expectStatus(
        await admin.get(`/drives/${driveId}/applications/${applicationId}/resume`),
        200,
      ).body as { url: string };
      expect(link.url).toContain('http');
      expect(
        await prisma.auditLog.count({ where: { action: 'placement.resume_viewed' } }),
      ).toBeGreaterThan(0);
      expect(
        (await trainer.get(`/drives/${driveId}/applications/${applicationId}/resume`)).status,
      ).toBe(403);
    });

    it('exports the applicants, and records the export', async () => {
      const exported = expectStatus(await admin.post(`/drives/${driveId}/applications/export`), 200)
        .body as { filename: string; csv: string };
      expect(exported.filename).toMatch(/^applicants-.*\.csv$/);
      expect(exported.csv).toContain(applicantCode);
      expect(
        await prisma.auditLog.count({
          where: { action: 'placement.applicants_exported', resourceId: driveId },
        }),
      ).toBe(1);
      expect((await trainer.post(`/drives/${driveId}/applications/export`)).status).toBe(403);
    });
  });
  // ───────────────────────── ADM-11: privacy ─────────────────────────

  describe('a learner’s data, handed over and erased', () => {
    let person: Awaited<ReturnType<typeof learner>>;
    let storage: StorageDriver;
    let courseId = '';
    let doubtId = '';
    const certificateCode = `P${unique}QQQQQ`;
    const documentKey = `test/ops/${unique}/identity.pdf`;
    const certificateKey = `test/ops/${unique}/certificate.pdf`;

    beforeAll(async () => {
      storage = app.get<StorageDriver>(STORAGE_DRIVER);
      person = await learner('privacy');
      await prisma.batchMember.create({ data: { batchId, studentId: person.studentId } });
      await storage.put(
        'private',
        documentKey,
        new TextEncoder().encode('%PDF-1.4 identity'),
        'application/pdf',
      );
      const file = await prisma.file.create({
        data: {
          organizationId,
          ownerType: 'student-document',
          ownerId: person.studentId,
          uploadedById: person.userId,
          driver: 's3',
          bucket: 'lms-private',
          key: documentKey,
          originalName: 'identity.pdf',
          mime: 'application/pdf',
          size: 17,
          visibility: 'private',
          status: 'ready',
        },
      });
      await prisma.document.create({
        data: { studentId: person.studentId, type: 'id_proof', title: 'Identity', fileId: file.id },
      });
      courseId = (
        expectStatus(
          await admin.post('/courses', {
            title: `Privacy ${unique}`,
            level: 'beginner',
            subject: 'core-java',
          }),
          201,
        ).body as CourseSummary
      ).id;
      await storage.put(
        'private',
        certificateKey,
        new TextEncoder().encode('%PDF-1.4 certificate'),
        'application/pdf',
      );
      await prisma.certificate.create({
        data: {
          organizationId,
          studentId: person.studentId,
          courseId,
          code: certificateCode,
          learnerName: 'Ops privacy',
          courseTitle: `Privacy ${unique}`,
          institute: 'SI Academy',
          completedAt: new Date(),
          objectKey: certificateKey,
        },
      });
      const staff = await prisma.user.findUniqueOrThrow({
        where: { email: TEST_ACCOUNTS.trainer.email },
      });
      doubtId = (
        await prisma.doubt.create({
          data: {
            organizationId,
            studentId: person.studentId,
            title: `My question ${unique}`,
            body: 'I am Ops privacy and I am stuck',
          },
        })
      ).id;
      await prisma.doubtReply.create({ data: { doubtId, authorId: staff.id, body: 'Try again' } });
      await prisma.studentNote.create({
        data: { studentId: person.studentId, authorId: staff.id, text: `Staff only ${unique}` },
      });
      await prisma.notification.create({
        data: {
          userId: person.userId,
          category: 'system',
          type: 'test.note',
          title: `Hello ${unique}`,
        },
      });
    });

    afterAll(async () => {
      await prisma.doubt.deleteMany({ where: { id: doubtId } });
      await prisma.certificate.deleteMany({ where: { code: certificateCode } });
      if (courseId) expectStatus(await admin.delete(`/courses/${courseId}`), 200);
    });

    it('is the Super Admin’s alone, whoever calls the API', async () => {
      for (const session of [admin, trainer, student]) {
        expect((await session.post(`/users/${person.userId}/privacy/export`)).status).toBe(403);
        expect(
          (
            await session.post(`/users/${person.userId}/privacy/erase`, {
              confirmEmail: person.email,
              reason: 'Asked to',
            })
          ).status,
        ).toBe(403);
      }
    });

    it('hands over what the learner gave and did, and not what staff keep about them', async () => {
      const exported = expectStatus(
        await superAdmin.post(`/users/${person.userId}/privacy/export`),
        200,
      ).body as { filename: string; data: LearnerDataExport };
      expect(exported.filename).toMatch(/^learner-data-.+[.]json$/);
      expect(exported.data.account.email).toBe(person.email);
      expect(exported.data.batches.map((b) => b.code)).toContain(TEST_FIXTURES.assignedBatchCode);
      expect(exported.data.documents.map((d) => d.fileName)).toEqual(['identity.pdf']);
      expect(exported.data.certificates.map((c) => c.code)).toEqual([certificateCode]);
      expect(exported.data.doubts[0]?.replies.map((r) => r.from)).toEqual(['staff']);
      expect(exported.data.notifications.map((n) => n.title)).toContain(`Hello ${unique}`);
      expect(JSON.stringify(exported.data)).not.toContain(`Staff only ${unique}`);
      expect(
        await prisma.auditLog.count({
          where: { action: 'privacy.exported', resourceId: person.userId },
        }),
      ).toBe(1);
    });

    it('is refused for a staff account, and without the learner’s e-mail typed in', async () => {
      const staff = await prisma.user.findUniqueOrThrow({
        where: { email: TEST_ACCOUNTS.trainer.email },
      });
      const refused = await superAdmin.post(`/users/${staff.id}/privacy/erase`, {
        confirmEmail: TEST_ACCOUNTS.trainer.email,
        reason: 'Asked to',
      });
      expect(refused.status).toBe(422);
      const unconfirmed = await superAdmin.post(`/users/${person.userId}/privacy/erase`, {
        confirmEmail: 'someone-else@test.local',
        reason: 'Asked to',
      });
      expect(unconfirmed.status).toBe(400);
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: person.userId } })).deletedAt,
      ).toBeNull();
    });

    it('removes who the learner was, and keeps the records the figures are made of', async () => {
      // One course finished (the certificate's) and one still open (Phase 5).
      const openCourse = (
        expectStatus(
          await admin.post('/courses', { title: `Privacy open ${unique}`, level: 'beginner' }),
          201,
        ).body as CourseSummary
      ).id;
      await prisma.enrollment.createMany({
        data: [
          {
            studentId: person.studentId,
            courseId,
            status: 'completed',
            progressPct: 100,
            completedAt: new Date(),
          },
          { studentId: person.studentId, courseId: openCourse, progressPct: 50 },
        ],
      });
      const result = expectStatus(
        await superAdmin.post(`/users/${person.userId}/privacy/erase`, {
          confirmEmail: person.email.toUpperCase(),
          reason: 'The learner asked, by e-mail',
        }),
        200,
      ).body as PrivacyErasureResult;
      expect(result).toMatchObject({ documents: 1, certificates: 1, memberships: 1 });
      expect(result.files).toBeGreaterThanOrEqual(1);

      const user = await prisma.user.findUniqueOrThrow({ where: { id: person.userId } });
      expect(user.name).toBe(ERASED_LEARNER_NAME);
      expect(user.email).not.toContain('ops-privacy');
      expect(user.passwordHash).toBeNull();
      expect(user.deletedAt).not.toBeNull();
      expect((await new Session(app).login(person.email, password)).status).toBe(401);
      expect((await admin.get(`/students/${person.studentId}`)).status).toBe(404);

      expect(await storage.head('private', documentKey)).toBeFalsy();
      expect(await storage.head('private', certificateKey)).toBeFalsy();
      expect(await prisma.document.count({ where: { studentId: person.studentId } })).toBe(0);
      expect(await prisma.studentNote.count({ where: { studentId: person.studentId } })).toBe(0);
      expect(await prisma.notification.count({ where: { userId: person.userId } })).toBe(0);
      expect(
        await prisma.batchMember.count({ where: { studentId: person.studentId, isActive: true } }),
      ).toBe(0);
      const doubt = await prisma.doubt.findUniqueOrThrow({ where: { id: doubtId } });
      expect(doubt.body).not.toContain('Ops privacy');

      const check = expectStatus(
        await new Session(app).get(`/public/certificates/${certificateCode}`),
        200,
      ).body as { status: string };
      expect(check.status).toBe('revoked');
      expect(JSON.stringify(check)).not.toContain('Ops privacy');

      expect(
        await prisma.auditLog.count({
          where: { action: 'privacy.erased', resourceId: person.userId },
        }),
      ).toBe(1);
      // Nobody is left to export or erase.
      expect((await superAdmin.post(`/users/${person.userId}/privacy/export`)).status).toBe(404);

      // An erased account is a deactivated one: the open course is withdrawn, the finished one
      // stays as the institute's (anonymised) record, and nothing draws or issues a certificate for
      // them again — not the sweep, not a late completion event (Phase 5).
      const enrolments = await prisma.enrollment.findMany({
        where: { studentId: person.studentId },
        select: { courseId: true, status: true },
      });
      expect(enrolments.find((e) => e.courseId === openCourse)?.status).toBe('withdrawn');
      expect(enrolments.find((e) => e.courseId === courseId)?.status).toBe('completed');
      const certificates = app.get(CertificatesService);
      await certificates.sweep();
      await certificates.issue(person.studentId, courseId);
      const certificate = await prisma.certificate.findFirstOrThrow({
        where: { studentId: person.studentId },
      });
      expect(certificate.status).toBe('revoked');
      expect(certificate.objectKey).toBe('');
      expect(await prisma.certificate.count({ where: { studentId: person.studentId } })).toBe(1);
      expect(await storage.head('private', certificateKey)).toBeFalsy();
    });
  });

  // ───────────────────────── partial changes ─────────────────────────

  describe('a change to some fields', () => {
    it('keeps a course’s other details, the signatory and an announcement’s audience', async () => {
      const course = expectStatus(
        await admin.post('/courses', {
          title: `Kept ${unique}`,
          description: 'Keep me',
          level: 'beginner',
          subject: 'core-java',
          tags: ['kept'],
          estimatedMinutes: 90,
        }),
        201,
      ).body as CourseSummary;
      const renamed = expectStatus(
        await admin.patch(`/courses/${course.id}`, { title: `Kept and renamed ${unique}` }),
        200,
      ).body as CourseSummary;
      expect(renamed).toMatchObject({
        description: 'Keep me',
        level: 'beginner',
        tags: ['kept'],
        estimatedMinutes: 90,
      });
      expectStatus(await admin.delete(`/courses/${course.id}`), 200);

      expectStatus(
        await superAdmin.patch('/settings', {
          records: { certificateSignatoryName: 'Kept Signatory' },
        }),
        200,
      );
      const settings = expectStatus(
        await superAdmin.patch('/settings', { records: { auditRetentionDays: 1095 } }),
        200,
      ).body as { records: { certificateSignatoryName: string; auditRetentionDays: number } };
      expect(settings.records).toMatchObject({
        certificateSignatoryName: 'Kept Signatory',
        auditRetentionDays: 1095,
      });
      expectStatus(
        await superAdmin.patch('/settings', {
          records: { certificateSignatoryName: '', auditRetentionDays: null },
        }),
        200,
      );

      const announcement = expectStatus(
        await admin.post('/announcements', {
          title: `Kept audience ${unique}`,
          body: 'For one batch only',
          audience: { batchIds: [batchId] },
          startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        }),
        201,
      ).body as AnnouncementItem;
      const retitled = expectStatus(
        await admin.patch(`/announcements/${announcement.id}`, {
          title: `Kept audience, retitled ${unique}`,
        }),
        200,
      ).body as AnnouncementItem;
      expect(retitled.audience.batchIds).toEqual([batchId]);
      expectStatus(await admin.delete(`/announcements/${announcement.id}`), 204);
    });
  });

  // ───────────────────────── ADM-12 / ADM-13: records ─────────────────────────

  describe('what the institute keeps on record', () => {
    afterAll(async () => {
      await superAdmin.patch('/settings', {
        records: {
          auditRetentionDays: null,
          certificateSignatoryName: '',
          certificateSignatoryTitle: '',
        },
      });
    });

    it('names a certificate signatory, and keeps the audit log at least three years', async () => {
      expect(
        (await superAdmin.patch('/settings', { records: { auditRetentionDays: 30 } })).status,
      ).toBe(400);
      expect(
        (await admin.patch('/settings', { records: { certificateSignatoryName: 'Admin' } })).status,
      ).toBe(403);
      const saved = expectStatus(
        await superAdmin.patch('/settings', {
          records: {
            certificateSignatoryName: 'Dr Meera Nair',
            certificateSignatoryTitle: 'Director of Studies',
          },
        }),
        200,
      ).body as { records: { certificateSignatoryName: string } };
      expect(saved.records.certificateSignatoryName).toBe('Dr Meera Nair');
    });

    it('sweeps expired exports, old import sheets and, when asked, old audit entries', async () => {
      const storage = app.get<StorageDriver>(STORAGE_DRIVER);
      const key = `test/ops/${unique}/expired.csv`;
      await storage.put('private', key, new TextEncoder().encode('a,b'), 'text/csv');
      const requester = await prisma.user.findUniqueOrThrow({
        where: { email: TEST_ACCOUNTS.admin.email },
      });
      const exported = await prisma.reportExport.create({
        data: {
          organizationId,
          report: 'students',
          format: 'csv',
          filename: 'expired.csv',
          status: 'ready',
          objectKey: key,
          requestedById: requester.id,
          expiresAt: new Date(Date.now() - 86_400_000),
        },
      });
      const sheet = await prisma.importJob.create({
        data: {
          organizationId,
          type: 'students',
          status: 'done',
          params: { rows: [{ email: 'someone@example.test' }] },
          errors: [{ row: 2, message: 'someone@example.test is taken' }],
          finishedAt: new Date(Date.now() - 40 * 86_400_000),
        },
      });
      const old = await prisma.auditLog.create({
        data: {
          organizationId,
          action: 'test.old_entry',
          resourceType: 'test',
          summary: 'An entry from long ago',
          occurredAt: new Date(Date.now() - 4 * 365 * 86_400_000),
        },
      });
      expectStatus(
        await superAdmin.patch('/settings', { records: { auditRetentionDays: 1095 } }),
        200,
      );
      const removed = await app.get(RetentionService).sweep();
      expect(removed.exports).toBeGreaterThanOrEqual(1);
      expect(removed.imports).toBeGreaterThanOrEqual(1);
      expect(removed.auditEntries).toBeGreaterThanOrEqual(1);
      expect(
        (await prisma.reportExport.findUniqueOrThrow({ where: { id: exported.id } })).status,
      ).toBe('expired');
      expect(await storage.head('private', key)).toBeFalsy();
      const cleared = await prisma.importJob.findUniqueOrThrow({ where: { id: sheet.id } });
      expect(cleared.params).toEqual({});
      expect(cleared.errors).toEqual([]);
      expect(await prisma.auditLog.count({ where: { id: old.id } })).toBe(0);
      expect(await prisma.auditLog.count({ where: { action: 'retention.swept' } })).toBeGreaterThan(
        0,
      );
    });
  });
});
