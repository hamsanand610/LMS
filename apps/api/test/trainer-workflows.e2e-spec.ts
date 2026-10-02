import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type {
  AnnouncementItem,
  CourseSummary,
  ExportJobRecord,
  Paginated,
  ReviewQueueItem,
  TestSummary,
  TrainerDashboard,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

/**
 * Phase 3: the trainer's own workflows (TRN-01 to TRN-10), each checked from the side that may act
 * and from the side that must be refused.
 */
describe('trainer workflows', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let trainer: Session;
  let student: Session;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);

  let batchId = '';
  let otherBatchId = '';
  let trainerUserId = '';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = new Session(app);
    trainer = new Session(app);
    student = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.admin.email, password), 200);
    expectStatus(await trainer.login(TEST_ACCOUNTS.trainer.email, password), 200);
    expectStatus(await student.login(TEST_ACCOUNTS.student.email, password), 200);
    batchId = (
      await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.assignedBatchCode } })
    ).id;
    otherBatchId = (
      await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.otherBatchCode } })
    ).id;
    trainerUserId = (
      await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.trainer.email } })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ───────────────────────── TRN-08 / D7: announcements ─────────────────────────

  describe('announcements', () => {
    let adminAnnouncementId = '';

    const announcement = (title: string, audience: object) => ({
      title,
      body: 'Bring your laptops tomorrow.',
      audience: { roleKeys: [], batchIds: [], programIds: [], ...audience },
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 86_400_000).toISOString(),
      channels: ['in_app'],
    });

    afterAll(async () => {
      await prisma.announcement.updateMany({
        where: { title: { endsWith: unique } },
        data: { deletedAt: new Date() },
      });
    });

    it('lets a trainer announce to the batches they teach', async () => {
      const item = expectStatus(
        await trainer.post(
          '/announcements',
          announcement(`Lab day ${unique}`, { batchIds: [batchId] }),
        ),
        201,
      ).body as AnnouncementItem;
      expect(item.status).toBe('active');
      expect(item.recipientCount).toBeGreaterThan(0);
      expect(item.author).toEqual({ id: trainerUserId, name: TEST_ACCOUNTS.trainer.name });
      const inbox = expectStatus(await student.get('/me/notifications/announcements'), 200)
        .body as AnnouncementItem[];
      expect(inbox.map((a) => a.title)).toContain(`Lab day ${unique}`);
    });

    it('refuses an audience beyond their batches', async () => {
      for (const audience of [
        { batchIds: [otherBatchId] },
        { batchIds: [batchId], roleKeys: ['student'] },
        { batchIds: [batchId], programIds: [otherBatchId] },
        {},
      ]) {
        const refused = await trainer.post(
          '/announcements',
          announcement(`Too wide ${unique}`, audience),
        );
        expect(refused.status, JSON.stringify(audience)).toBe(400);
      }
      expect(await prisma.announcement.count({ where: { title: `Too wide ${unique}` } })).toBe(0);
      expect(
        (await student.post('/announcements', announcement(`Learner ${unique}`, {}))).status,
      ).toBe(403);
    });

    it('shows a trainer their own, and an administrator everyone’s with the author', async () => {
      adminAnnouncementId = (
        expectStatus(await admin.post('/announcements', announcement(`Holiday ${unique}`, {})), 201)
          .body as AnnouncementItem
      ).id;
      const mine = expectStatus(await trainer.get('/announcements?pageSize=100'), 200)
        .body as Paginated<AnnouncementItem>;
      expect(mine.data.every((a) => a.author?.id === trainerUserId)).toBe(true);
      expect(mine.data.map((a) => a.title)).not.toContain(`Holiday ${unique}`);
      const all = expectStatus(await admin.get(`/announcements?q=${unique}&pageSize=100`), 200)
        .body as Paginated<AnnouncementItem>;
      expect(all.data.find((a) => a.title === `Lab day ${unique}`)?.author?.name).toBe(
        TEST_ACCOUNTS.trainer.name,
      );
    });

    it('lets a trainer change and remove only what they wrote', async () => {
      expect((await trainer.delete(`/announcements/${adminAnnouncementId}`)).status).toBe(403);
      expect(
        (await trainer.patch(`/announcements/${adminAnnouncementId}`, { title: 'Mine now' }))
          .status,
      ).toBe(403);
      const own = await prisma.announcement.findFirstOrThrow({
        where: { title: `Lab day ${unique}` },
      });
      expect(
        (
          await trainer.patch(`/announcements/${own.id}`, {
            audience: { roleKeys: [], batchIds: [otherBatchId], programIds: [] },
          })
        ).status,
        'not even by moving it to a batch they do not teach',
      ).toBe(400);
      expectStatus(await trainer.delete(`/announcements/${own.id}`), 204);
    });

    it('keeps the start of an announcement that has gone out', async () => {
      const moved = await admin.patch(`/announcements/${adminAnnouncementId}`, {
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      });
      expect(moved.status).toBe(422);
      expect(problemCode(moved)).toBe('announcement_delivered');
    });
  });

  // ───────────────────────── TRN-01 / TRN-09: the trainer's day ─────────────────────────

  describe('the trainer’s day', () => {
    let courseId = '';
    let testId = '';

    afterAll(async () => {
      if (courseId) expectStatus(await admin.delete(`/courses/${courseId}`), 200);
      if (testId)
        expectStatus(await admin.post(`/tests/${testId}/status`, { status: 'archived' }), 201);
    });

    it('counts the answers to review exactly as the review queue does', async () => {
      const dashboard = expectStatus(await trainer.get('/trainer/dashboard'), 200)
        .body as TrainerDashboard;
      const queue = expectStatus(await trainer.get('/submissions?state=pending&pageSize=1'), 200)
        .body as Paginated<ReviewQueueItem>;
      expect(dashboard.grading.assignments).toBe(queue.meta.total);
    });

    it('lists their courses and what closes this week', async () => {
      const course = expectStatus(
        await admin.post('/courses', {
          title: `Dashboard course ${unique}`,
          level: 'beginner',
          subject: 'core-java',
        }),
        201,
      ).body as CourseSummary;
      courseId = course.id;
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
      expectStatus(
        await admin.post(`/courses/${courseId}/publish`, { scopeType: 'batch', scopeId: batchId }),
        201,
      );
      testId = (
        expectStatus(
          await admin.post('/tests', { title: `Closing soon ${unique}`, kind: 'weekly' }),
          201,
        ).body as TestSummary
      ).id;
      const question = expectStatus(
        await admin.post('/questions', {
          title: `Dashboard question ${unique}`,
          body: 'True or false?',
          type: 'true_false',
          options: [
            { body: 'True', isCorrect: true },
            { body: 'False', isCorrect: false },
          ],
        }),
        201,
      ).body as { id: string };
      expectStatus(
        await admin.post(`/questions/${question.id}/status`, { status: 'published' }),
        201,
      );
      expectStatus(
        await admin.put(`/tests/${testId}/paper`, {
          sections: [{ title: 'One', instructions: '', questions: [{ questionId: question.id }] }],
        }),
        200,
      );
      expectStatus(await admin.post(`/tests/${testId}/status`, { status: 'published' }), 201);
      expectStatus(
        await admin.post(`/tests/${testId}/schedules`, {
          batchId,
          opensAt: new Date(Date.now() + 86_400_000).toISOString(),
          closesAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
        }),
        201,
      );
      const dashboard = expectStatus(await trainer.get('/trainer/dashboard'), 200)
        .body as TrainerDashboard;
      expect(dashboard.courses.map((c) => c.id)).toContain(courseId);
      expect(dashboard.deadlines).toContainEqual(
        expect.objectContaining({ kind: 'test', id: testId }),
      );
    });

    it('tells a trainer their export is ready on their own exports page', async () => {
      const job = expectStatus(
        await trainer.post('/exports', { report: 'students', format: 'csv', params: {} }),
        201,
      ).body as ExportJobRecord;
      const notice = await prisma.notification.findFirstOrThrow({
        where: { userId: trainerUserId, type: 'export.ready' },
        orderBy: { createdAt: 'desc' },
      });
      expect(job.status === 'ready' || job.status === 'queued' || job.status === 'running').toBe(
        true,
      );
      expect(notice.link).toBe('/trainer/exports');
    });
  });
});
