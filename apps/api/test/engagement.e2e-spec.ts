import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  SYSTEM_ROLES,
  type ApplicationRow,
  type CompanyDetail,
  type DoubtSummary,
  type DoubtThread,
  type DriveCard,
  type DriveDetail,
  type LeaderboardResponse,
  type LearningConsistency,
  type Paginated,
  type PlacementSummary,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { TenantService } from '../src/core/tenant/tenant.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

/**
 * Task 2 (ADR-0014): the leaderboard, doubts and placement. What each route lets each role do, and
 * — as much as anything — what it refuses: a learner never sees another batch's board or another
 * learner's doubt, a trainer only their own batches, and only staff move a drive or an application.
 */
describe('Task 2: leaderboard, doubts and placement', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = inject('password');
  const superAdmin = () => sessions.superAdmin;
  const sessions = {} as Record<
    'superAdmin' | 'admin' | 'trainer' | 'student' | 'outsider',
    Session
  >;

  let organizationId = '';
  let assignedBatchId = '';
  let otherBatchId = '';
  let studentId = '';
  let outsiderStudentId = '';
  let outsiderUserId = '';
  const outsiderEmail = `outsider-${Date.now()}@test.local`;
  const created = { companies: [] as string[], questions: [] as string[], courses: [] as string[] };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    organizationId = (await app.get(TenantService).getOrganization()).id;
    assignedBatchId = (
      await prisma.batch.findFirstOrThrow({ where: { code: TEST_FIXTURES.assignedBatchCode } })
    ).id;
    otherBatchId = (
      await prisma.batch.findFirstOrThrow({ where: { code: TEST_FIXTURES.otherBatchCode } })
    ).id;
    studentId = (
      await prisma.studentProfile.findFirstOrThrow({
        where: { user: { email: TEST_ACCOUNTS.student.email } },
      })
    ).id;

    // A learner in the other batch, so "someone else's" has a real someone.
    const role = await prisma.role.findUniqueOrThrow({
      where: { organizationId_key: { organizationId, key: SYSTEM_ROLES.STUDENT } },
    });
    const outsider = await prisma.user.create({
      data: {
        organizationId,
        email: outsiderEmail,
        name: 'Other Batch Learner',
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
        studentProfile: {
          // A code outside the institute's own STU-<year>-<nnnn> sequence: the allocator continues
          // from the highest code of the year, and a six-digit one would derail the codes after it.
          create: { studentCode: `STU-ENG-${String(Date.now()).slice(-6)}`, status: 'active' },
        },
      },
      include: { studentProfile: true },
    });
    outsiderUserId = outsider.id;
    outsiderStudentId = outsider.studentProfile!.id;
    await prisma.batchMember.create({
      data: { batchId: otherBatchId, studentId: outsiderStudentId },
    });

    for (const key of ['superAdmin', 'admin', 'trainer', 'student'] as const) {
      sessions[key] = new Session(app);
      expectStatus(await sessions[key].login(TEST_ACCOUNTS[key].email, password), 200);
    }
    sessions.outsider = new Session(app);
    expectStatus(await sessions.outsider.login(outsiderEmail, password), 200);

    // The template keeps these modules off; switch them on for the suite.
    for (const flag of ['module.gamification', 'module.placement', 'module.doubts']) {
      expectStatus(await superAdmin().patch(`/flags/${flag}`, { enabled: true }), 200);
    }
  });

  afterAll(async () => {
    await prisma.doubt.deleteMany({ where: { studentId: { in: [studentId, outsiderStudentId] } } });
    await prisma.driveApplication.deleteMany({
      where: { studentId: { in: [studentId, outsiderStudentId] } },
    });
    await prisma.placementDrive.deleteMany({ where: { companyId: { in: created.companies } } });
    await prisma.company.deleteMany({ where: { id: { in: created.companies } } });
    await prisma.question.deleteMany({ where: { id: { in: created.questions } } });
    await prisma.course.deleteMany({ where: { id: { in: created.courses } } });
    // The extra learner leaves the roster and is retired, so later files count what they expect.
    await prisma.batchMember.deleteMany({ where: { studentId: outsiderStudentId } });
    await prisma.notification.deleteMany({ where: { userId: outsiderUserId } });
    await prisma.user.update({
      where: { id: outsiderUserId },
      data: { deletedAt: new Date(), status: 'deactivated' },
    });
    await app.close();
  });

  it('keeps each route behind its module flag', async () => {
    expectStatus(await superAdmin().patch('/flags/module.doubts', { enabled: false }), 200);
    const blocked = await sessions.student.get('/me/doubts');
    expectStatus(blocked, 403);
    expect(problemCode(blocked)).toBe('module_disabled');
    expectStatus(await superAdmin().patch('/flags/module.doubts', { enabled: true }), 200);
    expectStatus(await sessions.student.get('/me/doubts'), 200);
  });

  // ───────────────────────── leaderboard ─────────────────────────

  describe('the leaderboard', () => {
    it('shows a learner their own batch, with short names only', async () => {
      const board = expectStatus(await sessions.student.get('/leaderboard'), 200)
        .body as LeaderboardResponse;
      expect(board.batch?.id).toBe(assignedBatchId);
      expect(board.batches.map((b) => b.id)).toEqual([assignedBatchId]);
      const me = board.entries.find((entry) => entry.isYou) ?? board.you;
      expect(me?.studentId).toBe(studentId);
      for (const entry of board.entries) {
        expect(entry.displayName.split(' ').length).toBeLessThanOrEqual(2);
      }
      expect(board.rules.length).toBeGreaterThan(0);
    });

    it('ignores a learner asking for another batch', async () => {
      const board = expectStatus(
        await sessions.student.get(`/leaderboard?batchId=${otherBatchId}`),
        200,
      ).body as LeaderboardResponse;
      expect(board.batch?.id).toBe(assignedBatchId);
      expect(board.entries.some((entry) => entry.studentId === outsiderStudentId)).toBe(false);
    });

    it('lets a trainer rank only the batches they teach', async () => {
      const board = expectStatus(
        await sessions.trainer.get(`/leaderboard?batchId=${otherBatchId}`),
        200,
      ).body as LeaderboardResponse;
      expect(board.batches.map((b) => b.id)).not.toContain(otherBatchId);
      expect(board.batch?.id).toBe(assignedBatchId);
    });

    it('lets an administrator choose any batch', async () => {
      const board = expectStatus(
        await sessions.admin.get(`/leaderboard?batchId=${otherBatchId}`),
        200,
      ).body as LeaderboardResponse;
      expect(board.batch?.id).toBe(otherBatchId);
      expect(board.entries.some((entry) => entry.studentId === outsiderStudentId)).toBe(true);
    });
  });

  // ───────────────────────── consistency ─────────────────────────

  describe('streak and adherence', () => {
    it('gives the learner a year of days and the rules behind the figures', async () => {
      const data = expectStatus(await sessions.student.get('/me/consistency'), 200)
        .body as LearningConsistency;
      expect(data.streak.days.length).toBe(365);
      expect(data.streak.current).toBeGreaterThanOrEqual(0);
      expect(data.definitions.activity.length).toBeGreaterThan(0);
      expect(data.adherence.windowDays).toBe(30);
    });

    it('shows staff a learner in their batch but not one outside it', async () => {
      expectStatus(await sessions.trainer.get(`/students/${studentId}/consistency`), 200);
      expectStatus(await sessions.trainer.get(`/students/${outsiderStudentId}/consistency`), 403);
      expectStatus(await sessions.student.get(`/students/${outsiderStudentId}/consistency`), 403);
    });
  });

  // ───────────────────────── doubts ─────────────────────────

  describe('doubts', () => {
    let doubtId = '';
    let outsiderDoubtId = '';

    it('lets a learner ask and their trainer answer', async () => {
      const asked = expectStatus(
        await sessions.student.post('/me/doubts', {
          title: 'Why does equals() matter for HashMap keys?',
          body: 'My map loses entries when I change the key.',
        }),
        201,
      ).body as DoubtThread;
      doubtId = asked.id;
      expect(asked.status).toBe('open');

      const queue = expectStatus(await sessions.trainer.get('/doubts?status=open'), 200)
        .body as Paginated<DoubtSummary>;
      expect(queue.data.map((d) => d.id)).toContain(doubtId);

      const answered = expectStatus(
        await sessions.trainer.post(`/doubts/${doubtId}/replies`, {
          body: 'The map files the entry under the hash at insertion time.',
        }),
        201,
      ).body as DoubtThread;
      expect(answered.status).toBe('answered');

      const thread = expectStatus(await sessions.student.get(`/me/doubts/${doubtId}`), 200)
        .body as DoubtThread;
      expect(thread.replies).toHaveLength(1);
      expect(thread.replies[0]?.author.isStaff).toBe(true);

      const resolved = expectStatus(
        await sessions.student.post(`/me/doubts/${doubtId}/status`, { status: 'resolved' }),
        200,
      ).body as DoubtThread;
      expect(resolved.status).toBe('resolved');
      expect(resolved.resolvedAt).not.toBeNull();
    });

    it('keeps the staff queue from learners', async () => {
      expectStatus(await sessions.student.get('/doubts'), 403);
      expectStatus(await sessions.student.post(`/doubts/${doubtId}/replies`, { body: 'x' }), 403);
    });

    it('keeps a doubt within the learner, their trainers and administrators', async () => {
      const asked = expectStatus(
        await sessions.outsider.post('/me/doubts', {
          title: 'A question from the other batch',
          body: 'Nobody outside my batch should read this.',
        }),
        201,
      ).body as DoubtThread;
      outsiderDoubtId = asked.id;

      expectStatus(await sessions.trainer.get(`/doubts/${outsiderDoubtId}`), 404);
      expectStatus(
        await sessions.trainer.post(`/doubts/${outsiderDoubtId}/replies`, { body: 'Hello' }),
        404,
      );
      expectStatus(await sessions.student.get(`/me/doubts/${outsiderDoubtId}`), 404);
      expectStatus(await sessions.admin.get(`/doubts/${outsiderDoubtId}`), 200);

      const mine = expectStatus(await sessions.student.get('/me/doubts'), 200)
        .body as Paginated<DoubtSummary>;
      expect(mine.data.map((d) => d.id)).not.toContain(outsiderDoubtId);
    });

    it('refuses a course the learner is not enrolled in', async () => {
      const course = await prisma.course.create({
        data: { organizationId, slug: `not-enrolled-${Date.now()}`, title: 'Not yours' },
      });
      created.courses.push(course.id);
      const res = await sessions.student.post('/me/doubts', {
        title: 'About a course I do not take',
        body: 'This should be refused.',
        courseId: course.id,
      });
      expectStatus(res, 400);
      expect(problemCode(res)).toBe('validation_failed');
    });
  });

  // ───────────────────────── placement ─────────────────────────

  describe('placement', () => {
    let companyId = '';
    let driveId = '';

    it('lets only staff manage companies, and keeps trainers out of placement', async () => {
      expectStatus(await sessions.student.post('/companies', { name: 'Should Fail' }), 403);
      expectStatus(await sessions.trainer.get('/companies'), 403);
      const company = expectStatus(
        await sessions.admin.post('/companies', {
          name: `Test Hiring Co ${Date.now()}`,
          industry: 'IT services',
        }),
        201,
      ).body as CompanyDetail;
      companyId = company.id;
      created.companies.push(companyId);
      expect(company.kit).toEqual([]);
    });

    it('builds a kit only from published practice problems', async () => {
      const stamp = Date.now();
      const draft = await prisma.question.create({
        data: {
          organizationId,
          slug: `kit-draft-${stamp}`,
          title: 'A draft problem',
          body: 'Not ready.',
          type: 'coding',
          status: 'draft',
        },
      });
      const ready = await prisma.question.create({
        data: {
          organizationId,
          slug: `kit-ready-${stamp}`,
          title: 'A practice problem',
          body: 'Ready.',
          type: 'coding',
          status: 'published',
          inPractice: true,
        },
      });
      created.questions.push(draft.id, ready.id);

      const refused = await sessions.admin.put(`/companies/${companyId}/kit`, {
        items: [{ questionId: draft.id, topic: 'Strings' }],
      });
      expectStatus(refused, 400);

      const kit = expectStatus(
        await sessions.admin.put(`/companies/${companyId}/kit`, {
          items: [{ questionId: ready.id, topic: 'Strings' }],
        }),
        200,
      ).body as CompanyDetail;
      expect(kit.kit.map((item) => item.questionId)).toEqual([ready.id]);

      // A learner reads it by its address, with their own status on each question.
      const seen = expectStatus(await sessions.student.get(`/companies/${kit.slug}`), 200)
        .body as CompanyDetail;
      expect(seen.kit[0]?.status).toBe('not_started');
      expectStatus(await sessions.student.put(`/companies/${companyId}/kit`, { items: [] }), 403);
    });

    it('keeps a draft drive from learners', async () => {
      const drive = expectStatus(
        await sessions.admin.post('/drives', {
          companyId,
          role: 'Associate Engineer',
          applyBy: new Date(Date.now() + 5 * 86_400_000).toISOString(),
          eligibility: { batchIds: [otherBatchId], programIds: [], minAttendancePct: null },
        }),
        201,
      ).body as DriveDetail;
      driveId = drive.id;
      expect(drive.status).toBe('draft');
      expect(drive.code).toMatch(/^DRV-\d{4}-\d{3}$/);

      expectStatus(await sessions.student.get(`/drives/${driveId}`), 404);
      const listed = expectStatus(await sessions.student.get('/drives?view=all'), 200)
        .body as Paginated<DriveCard>;
      expect(listed.data.map((d) => d.id)).not.toContain(driveId);
      expectStatus(await sessions.student.post('/drives', { companyId, role: 'x' }), 403);
    });

    it('lets an eligible learner apply once, and tells the others why they cannot', async () => {
      expectStatus(await sessions.admin.post(`/drives/${driveId}/status`, { status: 'open' }), 200);

      const refused = await sessions.student.post(`/drives/${driveId}/apply`);
      expectStatus(refused, 422);
      expect(problemCode(refused)).toBe('drive_not_eligible');
      const asSeen = expectStatus(await sessions.student.get(`/drives/${driveId}`), 200)
        .body as DriveDetail;
      expect(asSeen.eligible).toBe(false);
      expect(asSeen.ineligibleReasons.length).toBeGreaterThan(0);

      const applied = expectStatus(await sessions.outsider.post(`/drives/${driveId}/apply`), 200)
        .body as DriveDetail;
      expect(applied.application?.status).toBe('applied');
      expectStatus(await sessions.outsider.post(`/drives/${driveId}/apply`), 409);
      expect(applied.applyUrl).toBe('');
    });

    it('keeps the company’s official application link: https only, given to learners as written', async () => {
      const current = expectStatus(await sessions.admin.get(`/drives/${driveId}`), 200)
        .body as DriveDetail;
      const body = {
        companyId,
        role: current.role,
        applyBy: current.applyBy,
        eligibility: current.eligibility,
      };
      for (const bad of [
        'http://careers.example.com/jobs/1',
        'javascript:alert(1)',
        'ftp://careers.example.com/jobs/1',
        'careers.example.com/jobs/1',
      ]) {
        const refused = await sessions.admin.put(`/drives/${driveId}`, { ...body, applyUrl: bad });
        expect(refused.status, bad).toBe(400);
      }
      const link = 'https://careers.example.com/jobs/1234?ref=si-academy';
      const saved = expectStatus(
        await sessions.admin.put(`/drives/${driveId}`, { ...body, applyUrl: link }),
        200,
      ).body as DriveDetail;
      expect(saved.applyUrl).toBe(link);
      const seen = expectStatus(await sessions.outsider.get(`/drives/${driveId}`), 200)
        .body as DriveDetail;
      expect(seen.applyUrl).toBe(link);
      // Left out, it is cleared: the form always sends what it shows.
      const cleared = expectStatus(await sessions.admin.put(`/drives/${driveId}`, body), 200)
        .body as DriveDetail;
      expect(cleared.applyUrl).toBe('');

      const summary = expectStatus(await sessions.outsider.get('/me/placement'), 200)
        .body as PlacementSummary;
      expect(summary.applied).toBeGreaterThanOrEqual(1);
    });

    it('lets staff move an application, and only staff', async () => {
      const rows = expectStatus(await sessions.admin.get(`/drives/${driveId}/applications`), 200)
        .body as ApplicationRow[];
      expect(rows).toHaveLength(1);
      const applicationId = rows[0]!.id;

      expectStatus(
        await sessions.outsider.patch(`/drives/${driveId}/applications/${applicationId}`, {
          status: 'selected',
        }),
        403,
      );
      expectStatus(await sessions.outsider.get(`/drives/${driveId}/applications`), 403);

      const moved = expectStatus(
        await sessions.admin.patch(`/drives/${driveId}/applications/${applicationId}`, {
          status: 'shortlisted',
          note: 'Test on Monday at 10 am.',
        }),
        200,
      ).body as ApplicationRow;
      expect(moved.status).toBe('shortlisted');

      const learner = expectStatus(await sessions.outsider.get(`/drives/${driveId}`), 200)
        .body as DriveDetail;
      expect(learner.application?.status).toBe('shortlisted');
      expect(learner.application?.note).toBe('Test on Monday at 10 am.');
    });

    it('lets the learner withdraw, and then nobody moves it', async () => {
      const withdrawn = expectStatus(
        await sessions.outsider.post(`/drives/${driveId}/withdraw`),
        200,
      ).body as DriveDetail;
      expect(withdrawn.application?.status).toBe('withdrawn');
      const rows = expectStatus(await sessions.admin.get(`/drives/${driveId}/applications`), 200)
        .body as ApplicationRow[];
      const res = await sessions.admin.patch(`/drives/${driveId}/applications/${rows[0]!.id}`, {
        status: 'selected',
      });
      expectStatus(res, 422);
      expect(problemCode(res)).toBe('application_withdrawn');
    });

    it('refuses applications once a drive is closed', async () => {
      expectStatus(
        await sessions.admin.post(`/drives/${driveId}/status`, { status: 'closed' }),
        200,
      );
      const res = await sessions.outsider.post(`/drives/${driveId}/apply`);
      expectStatus(res, 422);
      expect(problemCode(res)).toBe('drive_closed');
    });
  });
});
