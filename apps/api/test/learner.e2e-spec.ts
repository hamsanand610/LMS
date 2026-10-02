import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  addDaysToDateKey,
  SYSTEM_ROLES,
  toLocalDateKey,
  type AssignmentDetail,
  type AssignmentSummary,
  type CertificateDownload,
  type CertificateRecord,
  type CertificateVerification,
  type CourseDetail,
  type CourseProgress,
  type CourseSummary,
  type DoubtThread,
  type LearnerAssignmentList,
  type LearnerQuestionWorkspace,
  type LessonPracticeView,
  type LessonProgressResult,
  type NotificationItem,
  type OwnDocumentRecord,
  type Paginated,
  type QuestionSummary,
  type ScheduleDeadline,
  type SearchResponse,
  type SessionItem,
  type SessionSeriesSummary,
  type AttemptResult,
  type AttemptState,
  type StudentDashboard,
  type SubmissionView,
  type TestSummary,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../src/core/storage/storage.driver.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { CertificatesService } from '../src/modules/certificates/index.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

const DAY = 86_400_000;
const PDF = new TextEncoder().encode('%PDF-1.7\n% test file\n');

/**
 * Roadmap Phase 2, the complete learner experience (docs/phases/PHASE-02-learner-experience.md),
 * through the API: watch time the server measures and the completion rule of each lesson type
 * (D2, D3); which courses a learner can reach and what leaving a batch does (D4, ADR-0010);
 * certificates and their public check (D5, ADR-0022); deadlines on the schedule; the dashboard's
 * panels; late work and the answer key (D7); documents, files and stored objects (LRN-19);
 * notifications, search and doubts. Every refusal is checked as well as every success.
 */
describe('Phase 2: the learner experience', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageDriver;
  let superAdmin: Session;
  let admin: Session;
  let trainer: Session;
  let student: Session;
  let peer: Session;
  let outsider: Session;
  let anonymous: Session;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);

  let organizationId = '';
  let timezone = 'Asia/Kolkata';
  let batchId = '';
  let studentId = '';
  let peerId = '';
  let peerUserId = '';
  let adminUserId = '';
  let mcqId = '';
  let resourceFileId = '';
  let resourceKey = '';
  let courseId = '';
  let draftCourseId = '';
  const lesson = { video: '', article: '', resources: '', practice: '', summary: '', extra: '' };
  let certificate: CertificateRecord | null = null;
  let testId = '';
  let dueAssignmentId = '';

  /** A learner of this spec's own, in the given batch, signed in. */
  async function learner(label: string, batchCode: string) {
    const role = await prisma.role.findFirstOrThrow({
      where: { organizationId, key: SYSTEM_ROLES.STUDENT },
    });
    const email = `p2-${label}-${unique}@test.local`;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `Phase Two ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
      },
    });
    const profile = await prisma.studentProfile.create({
      data: {
        userId: user.id,
        studentCode: `STU-P2${label[0]!.toUpperCase()}-${unique}`,
        status: 'active',
      },
    });
    const batch = await prisma.batch.findUniqueOrThrow({ where: { code: batchCode } });
    await prisma.batchMember.create({ data: { batchId: batch.id, studentId: profile.id } });
    const session = new Session(app);
    expectStatus(await session.login(email, password), 200);
    return { session, studentId: profile.id, userId: user.id };
  }

  /** A finished upload, as the uploader's browser leaves it; `stored` puts the bytes in storage. */
  async function uploaded(context: string, uploadedById: string, name: string, stored = true) {
    const key = `test/p2/${unique}/${Math.random().toString(36).slice(2)}-${name}`;
    const file = await prisma.file.create({
      data: {
        organizationId,
        ownerType: context,
        uploadedById,
        driver: 's3',
        bucket: 'lms-private',
        key,
        originalName: name,
        mime: 'application/pdf',
        size: PDF.byteLength,
        visibility: 'private',
        status: 'ready',
      },
    });
    if (stored) await storage.put('private', key, PDF, 'application/pdf');
    return { id: file.id, key };
  }

  /** Waits for work an event started after the response was sent. */
  async function eventually<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
    let value = await read();
    for (let tries = 0; tries < 60 && !done(value); tries += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      value = await read();
    }
    return value;
  }

  async function notifications(session: Session, query = ''): Promise<NotificationItem[]> {
    return (
      expectStatus(await session.get(`/me/notifications?pageSize=100${query}`), 200)
        .body as Paginated<NotificationItem>
    ).data;
  }

  /** Puts the last watch report `seconds` in the past, as if that much time had passed. */
  async function backdateWatching(lessonId: string, seconds: number, positionSeconds?: number) {
    await prisma.lessonProgress.update({
      where: { studentId_lessonId: { studentId, lessonId } },
      data: {
        lastProgressAt: new Date(Date.now() - seconds * 1000),
        ...(positionSeconds === undefined ? {} : { positionSeconds }),
      },
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    storage = app.get<StorageDriver>(STORAGE_DRIVER);
    const organization = await prisma.organization.findFirstOrThrow();
    organizationId = organization.id;
    timezone = organization.timezone;
    superAdmin = new Session(app);
    admin = new Session(app);
    trainer = new Session(app);
    student = new Session(app);
    anonymous = new Session(app);
    expectStatus(await superAdmin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    expectStatus(await admin.login(TEST_ACCOUNTS.admin.email, password), 200);
    expectStatus(await trainer.login(TEST_ACCOUNTS.trainer.email, password), 200);
    expectStatus(await student.login(TEST_ACCOUNTS.student.email, password), 200);
    batchId = (
      await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.assignedBatchCode } })
    ).id;
    studentId = (
      await prisma.studentProfile.findFirstOrThrow({
        where: { user: { email: TEST_ACCOUNTS.student.email } },
      })
    ).id;
    adminUserId = (
      await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.superAdmin.email } })
    ).id;
    const second = await learner('peer', TEST_FIXTURES.assignedBatchCode);
    peer = second.session;
    peerId = second.studentId;
    peerUserId = second.userId;
    outsider = (await learner('outsider', TEST_FIXTURES.otherBatchCode)).session;

    mcqId = (
      expectStatus(
        await superAdmin.post('/questions', {
          title: `P2 MCQ ${unique}`,
          body: 'Which keyword declares a constant in Java?',
          type: 'mcq_single',
          subject: 'core-java',
          marks: 2,
          explanation: 'final makes a variable a constant.',
          options: [
            { body: 'static', isCorrect: false },
            { body: 'final', isCorrect: true },
            { body: 'const', isCorrect: false },
          ],
        }),
        201,
      ).body as QuestionSummary
    ).id;
    expectStatus(await superAdmin.post(`/questions/${mcqId}/status`, { status: 'published' }), 201);
    const resource = await uploaded('lesson-resource', adminUserId, 'cheat-sheet.pdf');
    resourceFileId = resource.id;
    resourceKey = resource.key;
  });

  afterAll(async () => {
    await prisma.document.deleteMany({ where: { studentId: peerId } });
    await app.close();
  });

  // ───────────────────────── Courses and lessons (D2, D3) ─────────────────────────

  describe('a course a learner works through', () => {
    it('is built with one lesson of every kind and published to the batch', async () => {
      courseId = (
        expectStatus(
          await superAdmin.post('/courses', {
            title: `Phase Two Course c${unique}`,
            description: 'Built by the Phase 2 API tests.',
            level: 'beginner',
            subject: 'core-java',
            estimatedMinutes: 60,
          }),
          201,
        ).body as CourseSummary
      ).id;
      const detail = expectStatus(
        await superAdmin.put(`/courses/${courseId}/outline`, {
          modules: [
            {
              title: 'Watch and read',
              unlockRule: { type: 'always' },
              lessons: [
                { title: 'Intro video', type: 'video', durationSeconds: 120 },
                { title: 'Read me', type: 'article', content: { html: '<p>Read</p>' } },
                {
                  title: 'Handouts',
                  type: 'resources',
                  resources: [{ title: `Cheat sheet r${unique}`, fileId: resourceFileId }],
                },
                { title: 'Check yourself', type: 'practice', content: { questionId: mcqId } },
              ],
            },
            {
              title: 'Wrap up',
              unlockRule: { type: 'after_previous', minPercent: 100 },
              lessons: [{ title: 'Summary', type: 'article', content: { html: '<p>Done</p>' } }],
            },
          ],
        }),
        200,
      ).body as CourseDetail;
      const [first, second] = detail.modules;
      lesson.video = first!.lessons[0]!.id;
      lesson.article = first!.lessons[1]!.id;
      lesson.resources = first!.lessons[2]!.id;
      lesson.practice = first!.lessons[3]!.id;
      lesson.summary = second!.lessons[0]!.id;
      expect(first!.lessons.map((l) => l.completionRule)).toEqual([
        'watch',
        'manual',
        'manual',
        'pass',
      ]);

      expectStatus(
        await superAdmin.post(`/courses/${courseId}/publish`, {
          scopeType: 'batch',
          scopeId: batchId,
        }),
        201,
      );
      const mine = expectStatus(await peer.get('/me/courses'), 200).body as CourseProgress[];
      expect(mine.map((c) => c.courseId)).toContain(courseId);
    });

    it('refuses a completion rule the lesson type cannot meet', async () => {
      const response = await superAdmin.put(`/courses/${courseId}/outline`, {
        modules: [
          {
            title: 'Broken',
            unlockRule: { type: 'always' },
            lessons: [{ title: 'Quiz', type: 'practice', completionRule: 'manual' }],
          },
        ],
      });
      expect(response.status).toBe(400);
      expect(JSON.stringify(response.body)).toContain('answered correctly');
    });

    it('refuses "Mark complete" on a video that completes itself once watched', async () => {
      const response = await student.post(`/lessons/${lesson.video}/complete`);
      expect(response.status).toBe(422);
      expect(problemCode(response)).toBe('lesson_completes_on_watch');
    });

    it('credits only the watching the server can measure, never a jump to the end', async () => {
      const report = async (positionSeconds: number) =>
        expectStatus(
          await student.post(`/lessons/${lesson.video}/progress`, { positionSeconds }),
          201,
        ).body as LessonProgressResult;

      expect((await report(0)).watchedPct).toBe(0);
      // Seeking straight to the end a moment later earns next to nothing.
      const jumped = await report(120);
      expect(jumped.completed).toBe(false);
      expect(jumped.watchedPct).toBeLessThan(10);

      // A minute of real playback, reported after the time really passed.
      await backdateWatching(lesson.video, 40, 0);
      const half = await report(60);
      expect(half.completed).toBe(false);
      expect(half.watchedPct).toBe(50);

      await backdateWatching(lesson.video, 40);
      const done = await report(120);
      expect(done.completed).toBe(true);
      expect(done.newlyCompleted).toBe(true);
      expect(done.coursePct).toBe(20);

      const again = await report(120);
      expect(again.completed).toBe(true);
      expect(again.newlyCompleted, 'completion is announced once').toBe(false);
    });

    it('refuses a progress report that is not a position', async () => {
      const response = await student.post(`/lessons/${lesson.video}/progress`, { watchedPct: 100 });
      expect(response.status).toBe(400);
      expect(problemCode(response)).toBe('validation_failed');
    });

    it('completes a practice lesson only with a right answer', async () => {
      const refused = await student.post(`/lessons/${lesson.practice}/complete`);
      expect(refused.status).toBe(422);
      expect(problemCode(refused)).toBe('lesson_completes_on_answer');

      const view = expectStatus(await student.get(`/lessons/${lesson.practice}/practice`), 200)
        .body as LessonPracticeView;
      expect(JSON.stringify(view)).not.toContain('isCorrect');
      const options = view.question!.options;
      const wrong = options.find((o) => o.body === 'static')!;
      const right = options.find((o) => o.body === 'final')!;
      const missed = expectStatus(
        await student.post(`/lessons/${lesson.practice}/practice/submissions`, {
          optionIds: [wrong.id],
        }),
        201,
      ).body as { correct: boolean; completed: boolean; explanation: string };
      expect(missed).toMatchObject({ correct: false, completed: false, explanation: '' });
      const answered = expectStatus(
        await student.post(`/lessons/${lesson.practice}/practice/submissions`, {
          optionIds: [right.id],
        }),
        201,
      ).body as { correct: boolean; completed: boolean };
      expect(answered).toMatchObject({ correct: true, completed: true });
    });

    it('completes reading and resources lessons on the learner’s word', async () => {
      expectStatus(await student.post(`/lessons/${lesson.article}/complete`), 201);
      const last = expectStatus(await student.post(`/lessons/${lesson.resources}/complete`), 201)
        .body as { coursePct: number };
      expect(last.coursePct).toBe(80);
    });

    it('hands out a lesson file that is in storage, and "not found" for one that is lost', async () => {
      const resource = (
        expectStatus(await student.get(`/lessons/${lesson.resources}`), 200).body as {
          resources: { id: string; title: string }[];
        }
      ).resources[0]!;
      const link = expectStatus(
        await student.get(`/lessons/${lesson.resources}/resources/${resource.id}/url`),
        200,
      ).body as { url: string; expiresAt: string | null };
      expect(link.url).toContain('cheat-sheet.pdf');

      await storage.delete('private', resourceKey);
      const lost = await student.get(`/lessons/${lesson.resources}/resources/${resource.id}/url`);
      expect(lost.status).toBe(404);
      await storage.put('private', resourceKey, PDF, 'application/pdf');
    });

    it('recomputes every learner’s percentage when the outline changes (D1)', async () => {
      const before = expectStatus(await student.get(`/courses/${courseId}`), 200)
        .body as CourseDetail;
      expect(before.progressPct).toBe(80);
      expectStatus(
        await superAdmin.put(`/courses/${courseId}/outline`, {
          modules: [
            {
              id: before.modules[0]!.id,
              title: 'Watch and read',
              unlockRule: { type: 'always' },
              lessons: [
                {
                  id: lesson.video,
                  title: 'Intro video',
                  type: 'video',
                  durationSeconds: 120,
                  completionRule: 'watch',
                },
                { id: lesson.article, title: 'Read me', type: 'article', completionRule: 'manual' },
                {
                  id: lesson.resources,
                  title: 'Handouts',
                  type: 'resources',
                  completionRule: 'manual',
                  resources: [{ title: `Cheat sheet r${unique}`, fileId: resourceFileId }],
                },
                {
                  id: lesson.practice,
                  title: 'Check yourself',
                  type: 'practice',
                  completionRule: 'pass',
                  content: { questionId: mcqId },
                },
              ],
            },
            {
              id: before.modules[1]!.id,
              title: 'Wrap up',
              unlockRule: { type: 'after_previous', minPercent: 100 },
              lessons: [
                { id: lesson.summary, title: 'Summary', type: 'article', completionRule: 'manual' },
                {
                  title: 'Extra reading',
                  type: 'article',
                  content: { html: '<p>More</p>' },
                  completionRule: 'manual',
                },
              ],
            },
          ],
        }),
        200,
      );
      const after = expectStatus(await student.get(`/courses/${courseId}`), 200)
        .body as CourseDetail;
      lesson.extra = after.modules[1]!.lessons[1]!.id;
      expect(after.progressPct, 'four of six lessons now').toBe(67);
      const stored = await prisma.enrollment.findUniqueOrThrow({
        where: { studentId_courseId: { studentId, courseId } },
      });
      expect(stored.progressPct).toBe(67);
    });
  });

  // ───────────────────────── Which courses a learner can reach (D4) ─────────────────────────

  describe('the courses a learner can reach', () => {
    it('never lets a learner choose another status of course', async () => {
      draftCourseId = (
        expectStatus(
          await superAdmin.post('/courses', {
            title: `Hidden draft c${unique}`,
            level: 'beginner',
          }),
          201,
        ).body as CourseSummary
      ).id;
      const asked = expectStatus(await student.get('/courses?status=draft&pageSize=100'), 200)
        .body as Paginated<CourseSummary>;
      expect(asked.data.map((c) => c.id)).not.toContain(draftCourseId);
      expect(asked.data.every((c) => c.status === 'published')).toBe(true);
      const staff = expectStatus(await superAdmin.get('/courses?status=draft&pageSize=100'), 200)
        .body as Paginated<CourseSummary>;
      expect(staff.data.map((c) => c.id)).toContain(draftCourseId);
    });

    it('takes the course away from a learner who leaves the batch, keeping their record', async () => {
      expectStatus(await peer.post(`/lessons/${lesson.article}/complete`), 201);
      expectStatus(
        await superAdmin.delete(`/batches/${batchId}/members/${peerId}?reason=Moved`),
        204,
      );
      // The batch tells the enrolments through an event (rule 12), just after it answers.
      const enrolment = await eventually(
        () =>
          prisma.enrollment.findUniqueOrThrow({
            where: { studentId_courseId: { studentId: peerId, courseId } },
          }),
        (row) => row.status === 'withdrawn',
      );
      expect(enrolment.status).toBe('withdrawn');
      expect(enrolment.progressPct).toBeGreaterThan(0);

      const mine = expectStatus(await peer.get('/me/courses'), 200).body as CourseProgress[];
      expect(mine.map((c) => c.courseId)).not.toContain(courseId);
      expect((await peer.get(`/courses/${courseId}`)).status).toBe(403);
      expect((await peer.get(`/lessons/${lesson.article}`)).status).toBe(403);
      expect(
        (await peer.post(`/lessons/${lesson.video}/progress`, { positionSeconds: 5 })).status,
      ).toBe(403);
    });

    it('gives it back, where they left off, when they rejoin', async () => {
      expectStatus(
        await superAdmin.post(`/batches/${batchId}/members`, { studentIds: [peerId] }),
        201,
      );
      const enrolment = await eventually(
        () =>
          prisma.enrollment.findUniqueOrThrow({
            where: { studentId_courseId: { studentId: peerId, courseId } },
          }),
        (row) => row.status === 'active',
      );
      expect(enrolment.status).toBe('active');
      expect(enrolment.progressPct).toBeGreaterThan(0);
      expectStatus(await peer.get(`/courses/${courseId}`), 200);
    });

    it('keeps a learner outside the audience out entirely', async () => {
      expect((await outsider.get(`/courses/${courseId}`)).status).toBe(403);
      expect((await outsider.get(`/lessons/${lesson.article}`)).status).toBe(403);
      const theirs = expectStatus(await outsider.get('/me/courses'), 200).body as CourseProgress[];
      expect(theirs.map((c) => c.courseId)).not.toContain(courseId);
    });
  });

  // ───────────────────────── Certificates (D5, ADR-0022) ─────────────────────────

  describe('certificates', () => {
    it('issues one when the last lesson is completed, and tells the learner', async () => {
      expectStatus(await student.post(`/lessons/${lesson.summary}/complete`), 201);
      expect(
        (expectStatus(await student.get('/me/certificates'), 200).body as CertificateRecord[]).some(
          (c) => c.courseId === courseId,
        ),
        'not before the course is complete',
      ).toBe(false);
      expectStatus(await student.post(`/lessons/${lesson.extra}/complete`), 201);

      const list = await eventually(
        async () =>
          expectStatus(await student.get('/me/certificates'), 200).body as CertificateRecord[],
        (rows) => rows.some((c) => c.courseId === courseId && c.downloadable),
      );
      certificate = list.find((c) => c.courseId === courseId) ?? null;
      expect(certificate).not.toBeNull();
      expect(certificate!.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{12}$/);
      // The name is a snapshot of the account's name when the certificate was issued.
      const holder = await prisma.user.findUniqueOrThrow({
        where: { email: TEST_ACCOUNTS.student.email },
      });
      expect(certificate!.learnerName).toBe(holder.name);
      expect(certificate!.courseTitle).toBe(`Phase Two Course c${unique}`);
      expect(certificate!.status).toBe('issued');

      const notices = await notifications(student);
      expect(
        notices.some((n) => n.type === 'certificate.issued' && n.link === '/certificates'),
      ).toBe(true);
      expect(
        await prisma.auditLog.count({
          where: { action: 'certificate.issued', resourceId: certificate!.id },
        }),
      ).toBe(1);
    });

    it('issues it only once, however often it is asked for', async () => {
      const service = app.get(CertificatesService);
      await service.issue(studentId, courseId);
      await service.sweep();
      expect(await prisma.certificate.count({ where: { studentId, courseId } })).toBe(1);
    });

    it('lets its holder download it, and records the download', async () => {
      const download = expectStatus(
        await student.get(`/me/certificates/${certificate!.id}/download`),
        200,
      ).body as CertificateDownload;
      expect(download.filename).toBe(`Certificate - Phase Two Course c${unique}.pdf`);
      expect(download.url).toContain(`certificates/${organizationId}/${certificate!.id}.pdf`);
      const stored = await prisma.certificate.findUniqueOrThrow({ where: { id: certificate!.id } });
      const bytes = await storage.readHead('private', stored.objectKey!, 5);
      expect(new TextDecoder().decode(bytes!)).toBe('%PDF-');
      expect(
        await prisma.auditLog.count({
          where: { action: 'certificate.downloaded', resourceId: certificate!.id },
        }),
      ).toBeGreaterThan(0);
    });

    it('draws a PDF lost from storage again rather than failing', async () => {
      const stored = await prisma.certificate.findUniqueOrThrow({ where: { id: certificate!.id } });
      await storage.delete('private', stored.objectKey!);
      expectStatus(await student.get(`/me/certificates/${certificate!.id}/download`), 200);
      expect(await storage.head('private', stored.objectKey!)).not.toBeNull();
    });

    it('is nobody else’s: another learner and staff get "not found"', async () => {
      expect((await outsider.get(`/me/certificates/${certificate!.id}/download`)).status).toBe(404);
      expect((await peer.get(`/me/certificates/${certificate!.id}/download`)).status).toBe(404);
      expect((await trainer.get(`/me/certificates/${certificate!.id}/download`)).status).toBe(404);
      const theirs = expectStatus(await outsider.get('/me/certificates'), 200)
        .body as CertificateRecord[];
      expect(theirs).toEqual([]);
      expect((await outsider.get('/me/certificates/not-a-uuid/download')).status).toBe(400);
      expect((await anonymous.get('/me/certificates')).status).toBe(401);
    });

    it('confirms a code publicly, however it is typed, and shows nothing more', async () => {
      const verified = expectStatus(
        await anonymous.get(`/public/certificates/${certificate!.code}`),
        200,
      ).body as CertificateVerification;
      expect(Object.keys(verified).sort()).toEqual(
        [
          'code',
          'completedAt',
          'courseTitle',
          'institute',
          'issuedAt',
          'learnerName',
          'revokedAt',
          'status',
        ].sort(),
      );
      expect(verified.learnerName).toBe(certificate!.learnerName);
      expect(JSON.stringify(verified)).not.toMatch(/@test\.local|STU-|studentId/);

      const typed = certificate!.code.toLowerCase().replace(/(.{4})(?=.)/g, '$1-');
      expect(
        (
          expectStatus(await anonymous.get(`/public/certificates/${typed}`), 200)
            .body as CertificateVerification
        ).code,
      ).toBe(certificate!.code);
    });

    it('answers "not found" for an unknown code and refuses a malformed one', async () => {
      const unknown = certificate!.code.startsWith('0') ? '1'.repeat(12) : '0'.repeat(12);
      expect((await anonymous.get(`/public/certificates/${unknown}`)).status).toBe(404);
      const malformed = await anonymous.get('/public/certificates/ILLEGAL-CODE!');
      expect(malformed.status).toBe(400);
      expect(problemCode(malformed)).toBe('validation_failed');
    });

    it('says when a certificate has been revoked, and no longer hands it out', async () => {
      await prisma.certificate.update({
        where: { id: certificate!.id },
        data: { status: 'revoked', revokedAt: new Date(), revokedReason: 'Test' },
      });
      try {
        const verified = expectStatus(
          await anonymous.get(`/public/certificates/${certificate!.code}`),
          200,
        ).body as CertificateVerification;
        expect(verified.status).toBe('revoked');
        expect(verified.revokedAt).not.toBeNull();
        const refused = await student.get(`/me/certificates/${certificate!.id}/download`);
        expect(refused.status).toBe(422);
        expect(problemCode(refused)).toBe('certificate_revoked');
      } finally {
        await prisma.certificate.update({
          where: { id: certificate!.id },
          data: { status: 'issued', revokedAt: null, revokedReason: '' },
        });
      }
    });

    it('is switched off with its module', async () => {
      expectStatus(await superAdmin.patch('/flags/module.certificates', { enabled: false }), 200);
      try {
        const mine = await student.get('/me/certificates');
        expect(mine.status).toBe(403);
        expect(problemCode(mine)).toBe('module_disabled');
        expect((await anonymous.get(`/public/certificates/${certificate!.code}`)).status).toBe(403);
      } finally {
        expectStatus(await superAdmin.patch('/flags/module.certificates', { enabled: true }), 200);
      }
    });
  });

  // ───────────────────────── Schedule deadlines and the dashboard ─────────────────────────

  describe('deadlines and the dashboard', () => {
    it('puts work due and test windows closing on the learner’s schedule', async () => {
      const test = expectStatus(
        await superAdmin.post('/tests', {
          title: `P2 Weekly t${unique}`,
          kind: 'weekly',
          subject: 'core-java',
        }),
        201,
      ).body as TestSummary;
      testId = test.id;
      expectStatus(
        await superAdmin.put(`/tests/${testId}/paper`, {
          sections: [{ title: 'All', instructions: '', questions: [{ questionId: mcqId }] }],
        }),
        200,
      );
      expectStatus(await superAdmin.post(`/tests/${testId}/status`, { status: 'published' }), 201);
      expectStatus(
        await superAdmin.post(`/tests/${testId}/schedules`, {
          batchId,
          opensAt: new Date(Date.now() - 60_000).toISOString(),
          closesAt: new Date(Date.now() + 3 * DAY).toISOString(),
        }),
        201,
      );

      dueAssignmentId = (
        expectStatus(
          await superAdmin.post('/assignments', {
            title: `P2 Due a${unique}`,
            subject: 'core-java',
          }),
          201,
        ).body as AssignmentSummary
      ).id;
      expectStatus(
        await superAdmin.put(`/assignments/${dueAssignmentId}/structure`, {
          modules: [
            { title: 'One', unlockRule: { type: 'always' }, questions: [{ questionId: mcqId }] },
          ],
        }),
        200,
      );
      expectStatus(
        await superAdmin.post(`/assignments/${dueAssignmentId}/publish`, {
          batchId,
          opensAt: new Date(Date.now() - 60_000).toISOString(),
          dueAt: new Date(Date.now() + 2 * DAY).toISOString(),
        }),
        201,
      );

      const today = toLocalDateKey(new Date(), timezone);
      const deadlines = expectStatus(
        await student.get(`/me/deadlines?from=${today}&to=${addDaysToDateKey(today, 7)}`),
        200,
      ).body as ScheduleDeadline[];
      const due = deadlines.find((d) => d.kind === 'assignment' && d.id === dueAssignmentId);
      const closing = deadlines.find((d) => d.kind === 'test' && d.id === testId);
      expect(due).toMatchObject({ link: `/assignments/${dueAssignmentId}`, done: false });
      expect(closing).toMatchObject({ link: `/tests/${testId}`, done: false });
      expect(deadlines.map((d) => d.at)).toEqual([...deadlines.map((d) => d.at)].sort());

      // A range that ends before them leaves them out.
      const earlier = expectStatus(
        await student.get(
          `/me/deadlines?from=${addDaysToDateKey(today, -7)}&to=${addDaysToDateKey(today, -1)}`,
        ),
        200,
      ).body as ScheduleDeadline[];
      expect(earlier.some((d) => d.id === dueAssignmentId || d.id === testId)).toBe(false);
    });

    it('shows another batch’s learner none of them, and staff have no deadlines of their own', async () => {
      const theirs = expectStatus(await outsider.get('/me/deadlines'), 200)
        .body as ScheduleDeadline[];
      expect(theirs.some((d) => d.id === dueAssignmentId || d.id === testId)).toBe(false);
      expect((await trainer.get('/me/deadlines')).status).toBe(403);
      const malformed = await student.get('/me/deadlines?from=yesterday');
      expect(malformed.status).toBe(400);
    });

    it('gives the dashboard its notices, recent activity and certificates', async () => {
      const dashboard = expectStatus(await student.get('/me/dashboard'), 200)
        .body as StudentDashboard;
      expect(dashboard.notifications.length).toBeGreaterThan(0);
      expect(dashboard.notifications.length).toBeLessThanOrEqual(4);
      expect(dashboard.activity.length).toBeGreaterThan(0);
      expect(dashboard.activity.length).toBeLessThanOrEqual(6);
      expect(dashboard.certificates).toBeGreaterThanOrEqual(1);
    });
  });

  // ───────────────────────── Late work and the answer key (D7) ─────────────────────────

  describe('late work', () => {
    let lateId = '';
    let latePlacement = '';
    let options: { id: string; body: string }[] = [];

    it('accepts a late answer, marks it late, and keeps the key while another try is left', async () => {
      lateId = (
        expectStatus(
          await superAdmin.post('/assignments', {
            title: `P2 Late l${unique}`,
            subject: 'core-java',
            settings: {
              attemptsPerQuestion: 2,
              explanationPolicy: 'after_due',
              duePolicy: 'allow_late',
              gradingMethod: 'best',
            },
          }),
          201,
        ).body as AssignmentSummary
      ).id;
      const structure = expectStatus(
        await superAdmin.put(`/assignments/${lateId}/structure`, {
          modules: [
            { title: 'One', unlockRule: { type: 'always' }, questions: [{ questionId: mcqId }] },
          ],
        }),
        200,
      ).body as AssignmentDetail;
      latePlacement = structure.modules[0]!.questions[0]!.id;
      expectStatus(
        await superAdmin.post(`/assignments/${lateId}/publish`, {
          studentIds: [studentId],
          opensAt: new Date(Date.now() - 2 * DAY).toISOString(),
          dueAt: new Date(Date.now() - DAY).toISOString(),
        }),
        201,
      );
      const workspace = expectStatus(
        await student.get(`/me/assignments/${lateId}/questions/${latePlacement}`),
        200,
      ).body as LearnerQuestionWorkspace;
      options = workspace.question.options;
      const wrong = options.find((o) => o.body === 'static')!;

      const first = expectStatus(
        await student.post(`/me/assignments/${lateId}/questions/${latePlacement}/submissions`, {
          optionIds: [wrong.id],
        }),
        201,
      ).body as SubmissionView;
      expect(first.status).toBe('incorrect');
      expect(first.isLate).toBe(true);
      expect(first.correctOptionIds, 'one more try is left, so no key yet').toBeNull();
      expect(first.explanation).toBeNull();
    });

    it('shows the key once no answer can be given any more', async () => {
      const wrong = options.find((o) => o.body === 'const')!;
      const right = options.find((o) => o.body === 'final')!;
      const last = expectStatus(
        await student.post(`/me/assignments/${lateId}/questions/${latePlacement}/submissions`, {
          optionIds: [wrong.id],
        }),
        201,
      ).body as SubmissionView;
      expect(last.correctOptionIds).toEqual([right.id]);
      expect(last.explanation).toContain('final');
      const beyond = await student.post(
        `/me/assignments/${lateId}/questions/${latePlacement}/submissions`,
        { optionIds: [right.id] },
      );
      expect(beyond.status).toBe(422);
      expect(problemCode(beyond)).toBe('attempts_exhausted');
    });

    it('lets no submission past the attempt limit, however many arrive at once', async () => {
      const raceId = (
        expectStatus(
          await superAdmin.post('/assignments', {
            title: `P2 Race r${unique}`,
            subject: 'core-java',
            settings: {
              attemptsPerQuestion: 1,
              explanationPolicy: 'after_solve',
              duePolicy: 'allow_late',
              gradingMethod: 'best',
            },
          }),
          201,
        ).body as AssignmentSummary
      ).id;
      const structure = expectStatus(
        await superAdmin.put(`/assignments/${raceId}/structure`, {
          modules: [
            { title: 'One', unlockRule: { type: 'always' }, questions: [{ questionId: mcqId }] },
          ],
        }),
        200,
      ).body as AssignmentDetail;
      const placement = structure.modules[0]!.questions[0]!.id;
      expectStatus(
        await superAdmin.post(`/assignments/${raceId}/publish`, {
          studentIds: [peerId],
          opensAt: new Date(Date.now() - 60_000).toISOString(),
        }),
        201,
      );
      const workspace = expectStatus(
        await peer.get(`/me/assignments/${raceId}/questions/${placement}`),
        200,
      ).body as LearnerQuestionWorkspace;
      const wrong = workspace.question.options.find((o) => o.body === 'static')!;
      const responses = await Promise.all(
        Array.from({ length: 4 }, () =>
          peer.post(`/me/assignments/${raceId}/questions/${placement}/submissions`, {
            optionIds: [wrong.id],
          }),
        ),
      );
      const statuses = responses.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 422, 422, 422]);
      for (const refused of responses.filter((r) => r.status === 422)) {
        expect(problemCode(refused)).toBe('attempts_exhausted');
      }
      expect(
        await prisma.submission.count({ where: { assignmentId: raceId, studentId: peerId } }),
      ).toBe(1);
    });

    it('lists projects apart: a filter by question type', async () => {
      const projects = expectStatus(
        await student.get('/me/assignments?questionType=project&pageSize=50'),
        200,
      ).body as LearnerAssignmentList;
      expect(projects.data.map((a) => a.id)).not.toContain(dueAssignmentId);
      const objective = expectStatus(
        await student.get('/me/assignments?questionType=mcq_single&pageSize=50'),
        200,
      ).body as LearnerAssignmentList;
      expect(objective.data.map((a) => a.id)).toContain(dueAssignmentId);
      expect((await student.get('/me/assignments?questionType=essay')).status).toBe(400);
    });
  });

  // ───────────────────────── Documents and files (LRN-13, LRN-19) ─────────────────────────

  describe('documents and files', () => {
    let firstDocumentId = '';
    let secondDocumentId = '';
    let secondFileId = '';

    it('tells the learner a document was rejected, and the profile awaits a new one', async () => {
      const file = await uploaded('profile-document', peerUserId, 'id-old.pdf', false);
      const added = expectStatus(
        await peer.post('/me/documents', { type: 'id_proof', fileId: file.id, title: 'Identity' }),
        201,
      ).body as OwnDocumentRecord[];
      firstDocumentId = added.find((d) => d.title === 'Identity')!.id;
      expectStatus(
        await superAdmin.post(`/students/${peerId}/documents/${firstDocumentId}/verify`, {
          decision: 'rejected',
          reason: 'The photograph is unreadable.',
        }),
        201,
      );
      const profile = await prisma.studentProfile.findUniqueOrThrow({ where: { id: peerId } });
      expect(profile.verificationStatus).toBe('pending');
      const notices = await notifications(peer);
      expect(
        notices.some((n) => n.type === 'document.reviewed' && n.link === '/profile/documents'),
      ).toBe(true);
    });

    it('counts the newest document of a type: a verified replacement verifies the profile', async () => {
      const file = await uploaded('profile-document', peerUserId, 'id-new.pdf');
      secondFileId = file.id;
      const added = expectStatus(
        await peer.post('/me/documents', {
          type: 'id_proof',
          fileId: file.id,
          title: 'Identity again',
        }),
        201,
      ).body as OwnDocumentRecord[];
      secondDocumentId = added.find((d) => d.title === 'Identity again')!.id;
      expectStatus(
        await superAdmin.post(`/students/${peerId}/documents/${secondDocumentId}/verify`, {
          decision: 'verified',
          reason: '',
        }),
        201,
      );
      const profile = await prisma.studentProfile.findUniqueOrThrow({ where: { id: peerId } });
      expect(profile.verificationStatus).toBe('verified');
    });

    it('lets the learner download their own document, and nobody else through that route', async () => {
      const own = expectStatus(await peer.get(`/me/documents/${secondDocumentId}/download`), 200)
        .body as { url: string; expiresAt: string };
      expect(own.url).toContain('id-new.pdf');
      expect(
        await prisma.auditLog.count({
          where: { resourceId: secondDocumentId, action: { contains: 'download' } },
        }),
      ).toBeGreaterThan(0);
      expect((await outsider.get(`/me/documents/${secondDocumentId}/download`)).status).toBe(404);
      expect((await student.get(`/me/documents/${secondDocumentId}/download`)).status).toBe(404);
      expect((await trainer.get(`/me/documents/${secondDocumentId}/download`)).status).toBe(403);
      // The first upload never reached storage: "not found", not a broken link.
      expect((await peer.get(`/me/documents/${firstDocumentId}/download`)).status).toBe(404);
    });

    it('keeps a file that belongs to a record from being deleted on its own', async () => {
      const attached = await peer.delete(`/files/${secondFileId}`);
      expect(attached.status).toBe(422);
      expect(problemCode(attached)).toBe('file_attached');
      const loose = await uploaded('profile-document', peerUserId, 'loose.pdf');
      expectStatus(await peer.delete(`/files/${loose.id}`), 204);
      expect(await storage.head('private', loose.key)).toBeNull();
      // Someone else's file is simply not there for them.
      expect((await outsider.delete(`/files/${secondFileId}`)).status).toBe(404);
    });
  });

  // ───────────────────────── Notifications, search and doubts ─────────────────────────

  describe('notifications', () => {
    it('marks one category read without touching the others', async () => {
      const unreadBefore = await notifications(student, '&unread=true');
      expect(unreadBefore.some((n) => n.category === 'content')).toBe(true);
      expect(unreadBefore.some((n) => n.category !== 'content')).toBe(true);
      const marked = expectStatus(
        await student.post('/me/notifications/read-all?category=content'),
        200,
      ).body as { marked: number };
      expect(marked.marked).toBeGreaterThan(0);

      expect(await notifications(student, '&unread=true&category=content')).toEqual([]);
      const unreadAfter = await notifications(student, '&unread=true');
      expect(unreadAfter.length).toBeGreaterThan(0);
      expect(unreadAfter.every((n) => n.readAt === null && n.category !== 'content')).toBe(true);
    });

    it('reads "unread=false" as read ones only, and refuses an unknown category', async () => {
      const read = await notifications(student, '&unread=false');
      expect(read.length).toBeGreaterThan(0);
      expect(read.every((n) => n.readAt !== null)).toBe(true);
      expect((await student.get('/me/notifications?category=gossip')).status).toBe(400);
      expect((await student.post('/me/notifications/read-all?category=gossip')).status).toBe(400);
    });
  });

  describe('search', () => {
    it('finds the learner’s course, its lessons by their files, and their tests', async () => {
      const courses = expectStatus(await student.get(`/search?q=c${unique}`), 200)
        .body as SearchResponse;
      const courseHits = courses.groups.find((g) => g.type === 'course')?.hits ?? [];
      expect(courseHits.map((h) => h.route)).toContain(`/courses/${courseId}`);
      expect(JSON.stringify(courses)).not.toContain(draftCourseId);

      const byFile = expectStatus(await student.get(`/search?q=r${unique}`), 200)
        .body as SearchResponse;
      const lessonHits = byFile.groups.find((g) => g.type === 'lesson')?.hits ?? [];
      expect(lessonHits.map((h) => h.route)).toContain(
        `/courses/${courseId}/lessons/${lesson.resources}`,
      );

      const tests = expectStatus(await student.get(`/search?q=t${unique}`), 200)
        .body as SearchResponse;
      const testHits = tests.groups.find((g) => g.type === 'test')?.hits ?? [];
      expect(testHits.map((h) => h.route)).toContain(`/tests/${testId}`);
    });

    it('shows a learner outside the audience none of it', async () => {
      for (const q of [`c${unique}`, `r${unique}`, `t${unique}`]) {
        const result = expectStatus(await outsider.get(`/search?q=${q}`), 200)
          .body as SearchResponse;
        expect(JSON.stringify(result)).not.toMatch(new RegExp(`${courseId}|${testId}`));
      }
      expect((await student.get('/search?q=a')).status).toBe(400);
    });
  });

  describe('doubts', () => {
    it('reaches the institute’s answerers when the learner’s batch has no trainer', async () => {
      const doubt = expectStatus(
        await outsider.post('/me/doubts', {
          title: 'Where do I start?',
          body: 'Which lesson comes first?',
        }),
        201,
      ).body as DoubtThread;
      const adminNotices = await eventually(
        () => notifications(admin),
        (rows) => rows.some((n) => n.link === `/admin/doubts/${doubt.id}`),
      );
      expect(
        adminNotices.some(
          (n) => n.type === 'doubt.asked' && n.link === `/admin/doubts/${doubt.id}`,
        ),
      ).toBe(true);
      const trainerNotices = await notifications(trainer);
      expect(JSON.stringify(trainerNotices)).not.toContain(doubt.id);
    });

    it('sends a trainer to their own queue, and reopens only a resolved doubt', async () => {
      const doubt = expectStatus(
        await student.post('/me/doubts', { title: 'Why final?', body: 'Why not const in Java?' }),
        201,
      ).body as DoubtThread;
      const trainerNotices = await eventually(
        () => notifications(trainer),
        (rows) => rows.some((n) => n.link === `/trainer/doubts/${doubt.id}`),
      );
      expect(trainerNotices.some((n) => n.link === `/trainer/doubts/${doubt.id}`)).toBe(true);

      expectStatus(
        await trainer.post(`/doubts/${doubt.id}/replies`, { body: 'const is reserved.' }),
        201,
      );
      const reopenedEarly = expectStatus(
        await student.post(`/me/doubts/${doubt.id}/status`, { status: 'open' }),
        200,
      ).body as DoubtThread;
      expect(reopenedEarly.status, 'an answered doubt is not reopened').toBe('answered');
      const resolved = expectStatus(
        await student.post(`/me/doubts/${doubt.id}/status`, { status: 'resolved' }),
        200,
      ).body as DoubtThread;
      expect(resolved.status).toBe('resolved');
      const reopened = expectStatus(
        await student.post(`/me/doubts/${doubt.id}/status`, { status: 'open' }),
        200,
      ).body as DoubtThread;
      expect(reopened.status).toBe('answered');
      expect((await outsider.get(`/me/doubts/${doubt.id}`)).status).toBe(404);
    });
  });

  describe('the timetable', () => {
    it('holds a class’s join link back from a learner until the class can be joined', async () => {
      const at = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
      // Taught by the batch's trainer, whose own timetable lists the classes they run.
      const trainerId = (
        await prisma.trainerProfile.findFirstOrThrow({
          where: { user: { email: TEST_ACCOUNTS.trainer.email } },
        })
      ).id;
      const later = expectStatus(
        await superAdmin.post(`/batches/${batchId}/sessions`, {
          subject: 'Core Java',
          trainerId,
          title: `P2 later s${unique}`,
          startsAt: at(2 * 24 * 60),
          endsAt: at(2 * 24 * 60 + 60),
          joinUrl: 'https://meet.example.com/p2-later',
          notes: 'Bring your laptop.',
        }),
        201,
      ).body as SessionItem;
      const soon = expectStatus(
        await superAdmin.post(`/batches/${batchId}/sessions`, {
          subject: 'Core Java',
          trainerId,
          title: `P2 soon s${unique}`,
          startsAt: at(10),
          endsAt: at(70),
          joinUrl: 'https://meet.example.com/p2-soon',
        }),
        201,
      ).body as SessionItem;

      const today = toLocalDateKey(new Date(), timezone);
      const range = `from=${today}&to=${addDaysToDateKey(today, 3)}`;
      const mine = expectStatus(await student.get(`/me/schedule?${range}`), 200)
        .body as SessionItem[];
      const mineLater = mine.find((s) => s.id === later.id)!;
      expect(mineLater.joinable).toBe(false);
      expect(mineLater.joinUrl, 'not handed out days ahead').toBe('');
      expect(mineLater.notes).toBe('Bring your laptop.');
      const mineSoon = mine.find((s) => s.id === soon.id)!;
      expect(mineSoon.joinable).toBe(true);
      expect(mineSoon.joinUrl).toBe('https://meet.example.com/p2-soon');

      const staff = expectStatus(await trainer.get(`/me/schedule?${range}`), 200)
        .body as SessionItem[];
      expect(staff.find((s) => s.id === later.id)?.joinUrl).toBe(
        'https://meet.example.com/p2-later',
      );
      const theirs = expectStatus(await outsider.get(`/me/schedule?${range}`), 200)
        .body as SessionItem[];
      expect(theirs.some((s) => s.id === later.id || s.id === soon.id)).toBe(false);

      // The same on every other route a learner can read a class through.
      const listed = expectStatus(
        await student.get(`/sessions?batchId=${batchId}&pageSize=100&${range}`),
        200,
      ).body as Paginated<SessionItem>;
      expect(listed.data.find((s) => s.id === later.id)?.joinUrl).toBe('');
      expect(listed.data.find((s) => s.id === soon.id)?.joinUrl).toBe(
        'https://meet.example.com/p2-soon',
      );
      expect(
        (expectStatus(await student.get(`/sessions/${later.id}`), 200).body as SessionItem).joinUrl,
      ).toBe('');
      expect(
        (expectStatus(await trainer.get(`/sessions/${later.id}`), 200).body as SessionItem).joinUrl,
      ).toBe('https://meet.example.com/p2-later');
      const series = await prisma.sessionSeries.create({
        data: {
          batchId,
          subject: 'Core Java',
          weekdays: ['sat'],
          startsTime: '07:00',
          endsTime: '08:00',
          fromDate: new Date(),
          untilDate: new Date(Date.now() + 7 * DAY),
          joinUrl: 'https://meet.example.com/p2-series',
        },
      });
      try {
        const asLearner = expectStatus(await student.get(`/batches/${batchId}/series`), 200)
          .body as SessionSeriesSummary[];
        expect(asLearner.find((s) => s.id === series.id)?.joinUrl).toBe('');
        const asTrainer = expectStatus(await trainer.get(`/batches/${batchId}/series`), 200)
          .body as SessionSeriesSummary[];
        expect(asTrainer.find((s) => s.id === series.id)?.joinUrl).toBe(
          'https://meet.example.com/p2-series',
        );
      } finally {
        await prisma.sessionSeries.delete({ where: { id: series.id } });
      }
    });
  });

  describe('search by staff', () => {
    it('shows a trainer the learners of the batches they teach, and no others', async () => {
      const found = expectStatus(await trainer.get(`/search?q=Phase%20Two&types=student`), 200)
        .body as SearchResponse;
      const names = (found.groups.find((g) => g.type === 'student')?.hits ?? []).map(
        (h) => h.title,
      );
      expect(names).toContain('Phase Two peer');
      expect(names).not.toContain('Phase Two outsider');
      const everyone = expectStatus(
        await superAdmin.get(`/search?q=Phase%20Two&types=student`),
        200,
      ).body as SearchResponse;
      const all = (everyone.groups.find((g) => g.type === 'student')?.hits ?? []).map(
        (h) => h.title,
      );
      expect(all).toEqual(expect.arrayContaining(['Phase Two peer', 'Phase Two outsider']));
    });
  });

  describe('a test sat in two batches', () => {
    it('keeps the key, and which answers were right, until every window has closed', async () => {
      const exam = expectStatus(
        await superAdmin.post('/tests', {
          title: `P2 Two windows w${unique}`,
          kind: 'weekly',
          subject: 'core-java',
          settings: {
            durationMinutes: 15,
            maxAttempts: 2,
            shuffleQuestions: false,
            shuffleOptions: false,
            resultPolicy: 'immediately',
            reviewPolicy: 'full',
            trackTabSwitches: true,
            requireFullScreen: false,
            showRank: false,
          },
        }),
        201,
      ).body as TestSummary;
      expectStatus(
        await superAdmin.put(`/tests/${exam.id}/paper`, {
          sections: [{ title: 'All', instructions: '', questions: [{ questionId: mcqId }] }],
        }),
        200,
      );
      expectStatus(await superAdmin.post(`/tests/${exam.id}/status`, { status: 'published' }), 201);
      const otherBatchId = (
        await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.otherBatchCode } })
      ).id;
      const windows: { id: string }[] = [];
      for (const [batch, closesIn] of [
        [batchId, 60],
        [otherBatchId, 2 * 24 * 60],
      ] as const) {
        windows.push(
          expectStatus(
            await superAdmin.post(`/tests/${exam.id}/schedules`, {
              batchId: batch,
              opensAt: new Date(Date.now() - 60_000).toISOString(),
              closesAt: new Date(Date.now() + closesIn * 60_000).toISOString(),
            }),
            201,
          ).body as { id: string },
        );
      }

      // The learner in the first batch sits it and gets the right answer.
      const state = expectStatus(await student.post(`/tests/${exam.id}/attempts`), 201)
        .body as AttemptState;
      const question = state.questions[0]!;
      const right = question.options.find((o) => o.body === 'final')!;
      expectStatus(
        await student.patch(`/attempts/${state.attemptId}/answers`, {
          answers: [
            {
              testQuestionId: question.testQuestionId,
              optionIds: [right.id],
              timeSpentSeconds: 20,
            },
          ],
        }),
        200,
      );
      expectStatus(await student.post(`/attempts/${state.attemptId}/submit`, {}), 201);
      const read = async () =>
        expectStatus(await student.get(`/attempts/${state.attemptId}/result`), 200)
          .body as AttemptResult;

      const lastClose = new Date(Date.now() + 2 * DAY).getTime();
      const first = await read();
      expect(first.released).toBe(true);
      expect(first.score).toBe(2);
      expect(first.questions, 'not even which answer was right').toEqual([]);
      expect(Date.parse(first.reviewOpensAt!)).toBeGreaterThan(lastClose - 60_000);

      // Their own window closes; the other batch is still sitting it.
      await prisma.testSchedule.update({
        where: { id: windows[0]!.id },
        data: { closesAt: new Date(Date.now() - 60_000) },
      });
      const second = await read();
      expect(second.questions).toEqual([]);
      expect(JSON.stringify(second)).not.toContain('correctOptionIds');

      // Every window closed: the review opens.
      await prisma.testSchedule.update({
        where: { id: windows[1]!.id },
        data: { closesAt: new Date(Date.now() - 60_000) },
      });
      const third = await read();
      expect(third.reviewOpensAt).toBeNull();
      expect(third.questions[0]?.correctOptionIds).toEqual([right.id]);
      expect(third.questions[0]?.status).toBe('correct');
    });
  });

  describe('watching two videos at once', () => {
    it('earns one clock, not two', async () => {
      const course = expectStatus(
        await superAdmin.post('/courses', { title: `P2 Two videos v${unique}`, level: 'beginner' }),
        201,
      ).body as CourseSummary;
      const outline = expectStatus(
        await superAdmin.put(`/courses/${course.id}/outline`, {
          modules: [
            {
              title: 'Both',
              unlockRule: { type: 'always' },
              lessons: [
                { title: 'First video', type: 'video', durationSeconds: 600 },
                { title: 'Second video', type: 'video', durationSeconds: 600 },
              ],
            },
          ],
        }),
        200,
      ).body as CourseDetail;
      expectStatus(
        await superAdmin.post(`/courses/${course.id}/publish`, {
          scopeType: 'batch',
          scopeId: batchId,
        }),
        201,
      );
      const [a, b] = outline.modules[0]!.lessons.map((l) => l.id);
      const report = async (lessonId: string, positionSeconds: number) =>
        expectStatus(await student.post(`/lessons/${lessonId}/progress`, { positionSeconds }), 201)
          .body as LessonProgressResult;
      await report(a!, 0);
      await report(b!, 0);
      // Forty seconds pass for both, as if both had been playing side by side.
      await prisma.lessonProgress.updateMany({
        where: { studentId },
        data: { lastProgressAt: new Date(Date.now() - 40_000) },
      });
      const watchedA = await report(a!, 60);
      const watchedB = await report(b!, 60);
      const seconds = async (lessonId: string) =>
        (
          await prisma.lessonProgress.findUniqueOrThrow({
            where: { studentId_lessonId: { studentId, lessonId } },
          })
        ).watchedSeconds;
      expect(await seconds(a!)).toBe(60);
      expect(await seconds(b!), 'the same forty seconds are not counted twice').toBeLessThanOrEqual(
        1,
      );
      expect(watchedA.watchedPct).toBe(10);
      expect(watchedB.watchedPct).toBe(0);

      // Two reports that arrive together are taken one at a time.
      await prisma.lessonProgress.updateMany({
        where: { studentId },
        data: { lastProgressAt: new Date(Date.now() - 40_000) },
      });
      await Promise.all([report(a!, 120), report(b!, 120)]);
      const total = (await seconds(a!)) + (await seconds(b!));
      expect(total, 'at most one report’s credit for the forty seconds').toBeLessThanOrEqual(
        60 + 60 + 1,
      );
    });
  });

  describe('certificates issued twice at once', () => {
    it('announce themselves once', async () => {
      // The peer finished the course in the records (as the sweep would find it); the event and the
      // sweep then both issue at the same moment.
      await prisma.enrollment.update({
        where: { studentId_courseId: { studentId: peerId, courseId } },
        data: { status: 'completed', progressPct: 100, completedAt: new Date() },
      });
      const service = app.get(CertificatesService);
      await Promise.all([service.issue(peerId, courseId), service.issue(peerId, courseId)]);
      expect(await prisma.certificate.count({ where: { studentId: peerId, courseId } })).toBe(1);
      const notices = await prisma.notification.count({
        where: { userId: peerUserId, type: 'certificate.issued' },
      });
      expect(notices).toBe(1);
      const audits = await prisma.auditLog.count({
        where: {
          action: 'certificate.issued',
          resourceId: (
            await prisma.certificate.findFirstOrThrow({ where: { studentId: peerId, courseId } })
          ).id,
        },
      });
      expect(audits).toBe(1);
    });
  });

  describe('doubts on a course left behind', () => {
    it('are refused once the learner is withdrawn from the course', async () => {
      await prisma.enrollment.update({
        where: { studentId_courseId: { studentId: peerId, courseId } },
        data: { status: 'withdrawn' },
      });
      try {
        const refused = await peer.post('/me/doubts', {
          title: 'About this course',
          body: 'Can I still ask about it?',
          courseId,
        });
        expect(refused.status).toBe(400);
        expect(problemCode(refused)).toBe('validation_failed');
      } finally {
        await prisma.enrollment.update({
          where: { studentId_courseId: { studentId: peerId, courseId } },
          data: { status: 'completed' },
        });
      }
    });
  });

  describe('changing a password', () => {
    it('counts wrong current passwords per account, whatever session they come from', async () => {
      const attempt = () =>
        peer.post('/auth/password/change', {
          currentPassword: 'not-the-password-1A!',
          newPassword: 'Another-Long-Password-9!',
        });
      for (let i = 0; i < 3; i += 1) expect((await attempt()).status).toBe(401);
      // A refreshed session would start a fresh count on the route; the account's count goes on.
      expectStatus(await peer.post('/auth/refresh'), 200);
      for (let i = 0; i < 2; i += 1) expect((await attempt()).status).toBe(401);
      const limited = await attempt();
      expect(limited.status).toBe(429);
      expect(problemCode(limited)).toBe('rate_limited');
    });
  });

  // ───────────────────────── Last: the public check's rate limit ─────────────────────────

  it('rate-limits the public certificate check by address', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 32; i += 1) {
      statuses.push((await anonymous.get(`/public/certificates/${certificate!.code}`)).status);
    }
    expect(statuses).toContain(429);
    expect(statuses.filter((s) => s !== 200 && s !== 429)).toEqual([]);
  });
});
