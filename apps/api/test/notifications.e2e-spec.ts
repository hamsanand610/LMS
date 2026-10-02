import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type {
  AnnouncementItem,
  NotificationItem,
  NotificationPreference,
  SearchResponse,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { createTestApp } from './setup/app.js';
import { problemCode, Session } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

describe('notifications, announcements and search', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let trainer: Session;
  let student: Session;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = new Session(app);
    trainer = new Session(app);
    student = new Session(app);
    expect((await admin.login(TEST_ACCOUNTS.admin.email, password)).status).toBe(200);
    expect((await trainer.login(TEST_ACCOUNTS.trainer.email, password)).status).toBe(200);
    expect((await student.login(TEST_ACCOUNTS.student.email, password)).status).toBe(200);
  });
  afterAll(async () => {
    await app.close();
  });

  it('delivers a broadcast to the addressed batch only', async () => {
    const batch = await prisma.batch.findFirstOrThrow({
      where: { code: TEST_FIXTURES.assignedBatchCode },
    });
    const other = await prisma.batch.findFirstOrThrow({
      where: { code: TEST_FIXTURES.otherBatchCode },
    });
    const title = `Batch notice ${unique}`;
    const response = await admin.post('/notifications/broadcast', {
      title,
      body: 'Bring your laptops tomorrow.',
      audience: { roleKeys: [], batchIds: [batch.id], programIds: [] },
      channels: ['in_app'],
    });
    expect(response.status).toBe(202);
    expect((response.body as { recipients: number }).recipients).toBeGreaterThan(0);

    const inbox = await student.get('/me/notifications');
    const titles = (inbox.body.data as NotificationItem[]).map((n) => n.title);
    expect(titles).toContain(title);

    const outsider = await prisma.notification.findFirst({
      where: {
        title,
        user: { studentProfile: { members: { some: { batchId: other.id, isActive: true } } } },
      },
    });
    expect(outsider, 'students of other batches are not reached').toBeNull();
  });

  it('narrows a batch-scoped sender to their own batches', async () => {
    const other = await prisma.batch.findFirstOrThrow({
      where: { code: TEST_FIXTURES.otherBatchCode },
    });
    const preview = await trainer.post('/notifications/broadcast/preview', {
      audience: { roleKeys: [], batchIds: [other.id], programIds: [] },
    });
    expect(preview.status).toBe(200);
    // The trainer is not assigned to that batch, so the audience collapses to their own batches.
    const own = await trainer.post('/notifications/broadcast/preview', {
      audience: { roleKeys: [], batchIds: [], programIds: [] },
    });
    expect((preview.body as { recipients: number }).recipients).toBeLessThanOrEqual(
      (own.body as { recipients: number }).recipients,
    );
  });

  it('never lets a trainer’s role filter reach past the batches they teach', async () => {
    // Before, a role was added on top of the batches: "admins" reached every administrator.
    const admins = await trainer.post('/notifications/broadcast', {
      title: `Role reach ${unique}`,
      body: 'Checking who this reaches.',
      audience: { roleKeys: ['admin', 'super_admin'], batchIds: [], programIds: [] },
    });
    expect(admins.status).toBe(202);
    expect((admins.body as { recipients: number }).recipients).toBe(0);

    const title = `Students of mine ${unique}`;
    const students = await trainer.post('/notifications/broadcast', {
      title,
      body: 'Only my own batch.',
      audience: { roleKeys: ['student'], batchIds: [], programIds: [] },
    });
    expect((students.body as { recipients: number }).recipients).toBeGreaterThan(0);
    const reached = await prisma.notification.findMany({
      where: { title },
      select: { user: { select: { email: true } } },
    });
    const emails = reached.map((row) => row.user.email);
    expect(emails).toContain(TEST_ACCOUNTS.student.email);
    expect(emails, 'a learner of a batch they do not teach').not.toContain(
      TEST_ACCOUNTS.lockout.email,
    );
  });

  it('links a broadcast to pages of this app only', async () => {
    for (const link of ['https://example.com/login', '//example.com', '/\\example.com']) {
      const response = await admin.post('/notifications/broadcast', {
        title: 'Outside link',
        body: 'Should be refused.',
        link,
      });
      expect(response.status, link).toBe(400);
    }
    const inside = await admin.post('/notifications/broadcast', {
      title: `Inside link ${unique}`,
      body: 'Points at the assignments page.',
      link: '/assignments',
      audience: { roleKeys: [], batchIds: [], programIds: [] },
    });
    expect(inside.status).toBe(202);
  });

  it('marks notifications read and keeps the unread count honest', async () => {
    const before = await student.get('/me/notifications/summary');
    const unreadBefore = (before.body as { unread: number }).unread;
    expect(unreadBefore).toBeGreaterThan(0);

    const list = await student.get('/me/notifications?unread=true');
    const first = (list.body.data as NotificationItem[])[0]!;
    expect((await student.patch(`/me/notifications/${first.id}/read`)).status).toBe(204);
    const after = await student.get('/me/notifications/summary');
    expect((after.body as { unread: number }).unread).toBe(unreadBefore - 1);

    const all = await student.post('/me/notifications/read-all');
    expect(all.status).toBe(200);
    const final = await student.get('/me/notifications/summary');
    expect((final.body as { unread: number }).unread).toBe(0);
  });

  it('stores channel preferences per category', async () => {
    const defaults = await student.get('/me/notifications/preferences');
    expect((defaults.body as NotificationPreference[]).length).toBeGreaterThan(0);
    const updated = await student.patch('/me/notifications/preferences', {
      preferences: [{ category: 'announcement', inApp: true, email: false }],
    });
    expect(updated.status).toBe(200);
    const announcement = (updated.body as NotificationPreference[]).find(
      (p) => p.category === 'announcement',
    );
    expect(announcement).toEqual({ category: 'announcement', inApp: true, email: false });
  });

  it('publishes an announcement immediately when its window has opened', async () => {
    const title = `Announcement ${unique}`;
    const response = await admin.post('/announcements', {
      title,
      body: 'The library is open until 8 pm this week.',
      audience: { roleKeys: ['student'], batchIds: [], programIds: [] },
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      channels: ['in_app'],
    });
    expect(response.status).toBe(201);
    const announcement = response.body as AnnouncementItem;
    expect(announcement.status).toBe('active');
    expect(announcement.recipientCount).toBeGreaterThan(0);
    expect(announcement.deliveredAt).not.toBeNull();

    const inbox = await student.get('/me/notifications?pageSize=50');
    expect((inbox.body.data as NotificationItem[]).map((n) => n.title)).toContain(title);
    const active = await student.get('/me/notifications/announcements');
    expect((active.body as AnnouncementItem[]).map((a) => a.title)).toContain(title);
  });

  it('holds a scheduled announcement until its start time', async () => {
    const response = await admin.post('/announcements', {
      title: `Scheduled ${unique}`,
      body: 'Results are released next Monday.',
      audience: { roleKeys: [], batchIds: [], programIds: [] },
      startsAt: new Date(Date.now() + 3_600_000).toISOString(),
      channels: ['in_app'],
    });
    const announcement = response.body as AnnouncementItem;
    expect(announcement.status).toBe('scheduled');
    expect(announcement.deliveredAt).toBeNull();
    expect(announcement.recipientCount).toBe(0);
    const delivered = await prisma.notification.count({ where: { title: `Scheduled ${unique}` } });
    expect(delivered).toBe(0);
  });

  it('rejects an announcement that ends before it starts', async () => {
    const response = await admin.post('/announcements', {
      title: 'Backwards window',
      body: 'x',
      startsAt: new Date(Date.now() + 7_200_000).toISOString(),
      endsAt: new Date(Date.now() + 3_600_000).toISOString(),
      channels: ['in_app'],
    });
    expect(response.status).toBe(400);
    expect((response.body.errors as { path: string }[])[0]?.path).toBe('endsAt');
  });

  it('reserves announcement management for the permission that grants it', async () => {
    // A trainer manages their own, to their own batches (Phases 3–4, D7: trainer-workflows spec).
    expect((await student.get('/announcements')).status).toBe(403);
    expect(
      (await student.post('/notifications/broadcast', { title: 'No', body: 'No' })).status,
    ).toBe(403);
  });

  it('returns only the search groups the caller may see', async () => {
    const adminHits = await admin.get('/search?q=Test');
    expect(adminHits.status).toBe(200);
    const adminTypes = (adminHits.body as SearchResponse).groups.map((g) => g.type);
    expect(adminTypes).toEqual(expect.arrayContaining(['student', 'trainer', 'program']));

    const batch = await prisma.batch.findFirstOrThrow({
      where: { code: TEST_FIXTURES.assignedBatchCode },
    });
    const batchHits = await admin.get(`/search?q=${TEST_FIXTURES.assignedBatchCode}`);
    const batchGroup = (batchHits.body as SearchResponse).groups.find((g) => g.type === 'batch');
    expect(batchGroup?.hits[0]?.route).toBe(`/admin/batches/${batch.id}`);

    // A learner searches their own learning (Task 2) and never a staff-only record.
    const studentHits = await student.get('/search?q=Test');
    expect(studentHits.status).toBe(200);
    const staffOnly = ['student', 'trainer', 'batch', 'program', 'user'];
    expect(
      (studentHits.body as SearchResponse).groups.filter((g) => staffOnly.includes(g.type)),
      'a student may search but matches nothing staff-only',
    ).toEqual([]);
  });

  it('limits search results to the caller batch scope', async () => {
    const hits = await trainer.get(`/search?q=${TEST_FIXTURES.otherBatchCode}`);
    const batches = (hits.body as SearchResponse).groups.find((g) => g.type === 'batch');
    expect(batches, 'the batch a trainer is not assigned to never appears').toBeUndefined();
  });

  it('requires a search term of at least two characters', async () => {
    const response = await admin.get('/search?q=a');
    expect(response.status).toBe(400);
    expect(problemCode(response)).toBe('validation_failed');
  });
});
