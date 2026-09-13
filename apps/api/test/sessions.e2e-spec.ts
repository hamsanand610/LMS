import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type {
  CourseSummary,
  Paginated,
  SeriesPreview,
  SessionItem,
  SessionSeriesSummary,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { SessionRemindersService } from '../src/modules/sessions/index.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

/** A date key a given number of days from today, in UTC. */
function dateKey(offsetDays: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

/**
 * J-07: an admin lays out a weekly timetable for a batch and the learner and the trainer both
 * see their own version of it. J-08: the trainer publishes the recording of a class into a course.
 */
describe('schedule, classes and recordings', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let trainer: Session;
  let student: Session;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);

  let batchId = '';
  let otherBatchId = '';
  let trainerId = '';
  let seriesId = '';
  let pastSessionId = '';
  let courseId = '';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = new Session(app);
    trainer = new Session(app);
    student = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    expectStatus(await trainer.login(TEST_ACCOUNTS.trainer.email, password), 200);
    expectStatus(await student.login(TEST_ACCOUNTS.student.email, password), 200);
    batchId = (
      await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.assignedBatchCode } })
    ).id;
    otherBatchId = (
      await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.otherBatchCode } })
    ).id;
    trainerId = (
      await prisma.trainerProfile.findFirstOrThrow({
        where: { user: { email: TEST_ACCOUNTS.trainer.email } },
      })
    ).id;
  });
  afterAll(async () => {
    await app.close();
  });

  const series = () => ({
    subject: 'Core Java',
    trainerId,
    weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    startsTime: '09:30',
    endsTime: '11:00',
    fromDate: dateKey(-7),
    untilDate: dateKey(7),
    joinUrl: 'https://classes.example.test/core-java',
    provider: 'other',
    skipDates: [dateKey(0)],
  });

  it('shows what a timetable would create before writing anything', async () => {
    const response = expectStatus(
      await admin.post(`/batches/${batchId}/series/preview`, series()),
      201,
    );
    const preview = response.body as SeriesPreview;
    expect(preview.occurrences.length).toBeGreaterThan(5);
    expect(preview.conflicts).toHaveLength(0);
    expect(
      preview.occurrences.some((o) => o.startsAt.startsWith(dateKey(0))),
      'the holiday is left out',
    ).toBe(false);

    expect(await prisma.sessionSeries.count({ where: { batchId } }), 'nothing was written').toBe(0);
  });

  it('creates the series and every class it implies', async () => {
    const response = expectStatus(
      await admin.post(`/batches/${batchId}/series`, { series: series() }),
      201,
    );
    const created = response.body as SessionSeriesSummary;
    seriesId = created.id;
    expect(created.sessionCount).toBeGreaterThan(5);
    expect(created.trainerName).toBe(TEST_ACCOUNTS.trainer.name);
    expect(await prisma.liveSession.count({ where: { seriesId } })).toBe(created.sessionCount);
  });

  it('refuses a second series that double-books the same batch', async () => {
    const response = await admin.post(`/batches/${batchId}/series`, {
      series: { ...series(), subject: 'SQL' },
    });
    expect(response.status).toBe(422);
    expect(problemCode(response)).toBe('session_conflict');
  });

  it('reports the clash and creates it anyway when that is the decision', async () => {
    const preview = expectStatus(
      await admin.post(`/batches/${batchId}/series/preview`, { ...series(), subject: 'SQL' }),
      201,
    ).body as SeriesPreview;
    expect(preview.conflicts.length).toBeGreaterThan(0);
    expect(preview.conflicts[0]?.reason).toMatch(/already has/i);

    const created = expectStatus(
      await admin.post(`/batches/${batchId}/series`, {
        series: { ...series(), subject: 'SQL', startsTime: '11:30', endsTime: '13:00' },
        allowConflicts: false,
      }),
      201,
    ).body as SessionSeriesSummary;
    expect(created.subject).toBe('SQL');
  });

  it('refuses a series whose days never fall inside the range', async () => {
    const response = await admin.post(`/batches/${batchId}/series`, {
      series: {
        ...series(),
        subject: 'Aptitude',
        weekdays: ['sun'],
        fromDate: dateKey(1),
        untilDate: dateKey(2),
      },
    });
    expect([422, 400]).toContain(response.status);
  });

  it('gives the learner their own timetable and nobody else’s', async () => {
    const mine = expectStatus(await student.get('/me/schedule'), 200).body as SessionItem[];
    expect(mine.length).toBeGreaterThan(0);
    expect(new Set(mine.map((s) => s.batchId))).toEqual(new Set([batchId]));
    expect(mine.every((s) => s.batchCode === TEST_FIXTURES.assignedBatchCode)).toBe(true);
    expect(mine.every((s) => s.startsAt <= s.endsAt)).toBe(true);
  });

  it('gives the trainer the classes they are teaching', async () => {
    const mine = expectStatus(await trainer.get('/me/schedule'), 200).body as SessionItem[];
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((s) => s.trainerId === trainerId)).toBe(true);
  });

  it('keeps a trainer out of a batch they do not teach', async () => {
    const response = await trainer.get(`/sessions?batchId=${otherBatchId}`);
    const list = expectStatus(response, 200).body as Paginated<SessionItem>;
    expect(list.data).toHaveLength(0);

    const write = await trainer.post(`/batches/${otherBatchId}/series`, { series: series() });
    expect(write.status).toBe(403);
  });

  it('lets the trainer mark their own class finished', async () => {
    const past = await prisma.liveSession.findFirstOrThrow({
      where: { seriesId, startsAt: { lt: new Date() } },
      orderBy: { startsAt: 'asc' },
    });
    pastSessionId = past.id;
    const response = expectStatus(
      await trainer.post(`/sessions/${pastSessionId}/status`, { status: 'completed' }),
      201,
    );
    expect((response.body as SessionItem).status).toBe('completed');
  });

  it('refuses a status change that makes no sense', async () => {
    const response = await trainer.post(`/sessions/${pastSessionId}/status`, { status: 'live' });
    expect(response.status).toBe(422);
    expect(problemCode(response)).toBe('invalid_status_transition');
  });

  it('tells the batch when a class is cancelled', async () => {
    const upcoming = await prisma.liveSession.findFirstOrThrow({
      where: { seriesId, startsAt: { gt: new Date() }, status: 'scheduled' },
      orderBy: { startsAt: 'asc' },
    });
    expectStatus(
      await trainer.post(`/sessions/${upcoming.id}/status`, {
        status: 'cancelled',
        reason: 'The trainer is unwell',
      }),
      201,
    );
    const studentUser = await prisma.user.findUniqueOrThrow({
      where: { email: TEST_ACCOUNTS.student.email },
    });
    const notification = await prisma.notification.findFirst({
      where: { userId: studentUser.id, type: 'session.cancelled' },
      orderBy: { createdAt: 'desc' },
    });
    expect(notification?.body).toContain('unwell');
  });

  it('sends a reminder once, and only once, for a class about to start', async () => {
    const soon = new Date(Date.now() + 10 * 60_000);
    const session = await prisma.liveSession.create({
      data: {
        batchId,
        trainerId,
        subject: `Reminder ${unique}`,
        startsAt: soon,
        endsAt: new Date(soon.getTime() + 60 * 60_000),
      },
    });
    const reminders = app.get(SessionRemindersService);
    expect(await reminders.sendDue()).toBeGreaterThan(0);
    expect(await reminders.sendDue(), 'the second run finds nothing left to send').toBe(0);

    const stamped = await prisma.liveSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(stamped.reminderSentAt).not.toBeNull();
  });

  it('publishes a class recording into a course as a lesson', async () => {
    courseId = (
      expectStatus(
        await admin.post('/courses', {
          title: `Recordings Target ${unique}`,
          level: 'beginner',
          subject: 'core-java',
        }),
        201,
      ).body as CourseSummary
    ).id;

    const response = expectStatus(
      await trainer.post(`/sessions/${pastSessionId}/recording`, {
        url: 'https://recordings.example.test/class-1',
        courseId,
        moduleTitle: 'Recordings',
      }),
      201,
    );
    const result = response.body as { lessonId: string; courseId: string; moduleId: string };
    expect(result.courseId).toBe(courseId);

    const lesson = await prisma.lesson.findUniqueOrThrow({
      where: { id: result.lessonId },
      include: { module: true, resources: true },
    });
    expect(lesson.module.title).toBe('Recordings');
    expect(lesson.isMandatory, 'catching up is never required to finish the course').toBe(false);
    expect(lesson.resources[0]?.url).toContain('recordings.example.test');

    const session = await prisma.liveSession.findUniqueOrThrow({ where: { id: pastSessionId } });
    expect(session.recordingLessonId).toBe(result.lessonId);
  });

  it('refuses a second recording for the same class', async () => {
    const response = await trainer.post(`/sessions/${pastSessionId}/recording`, {
      url: 'https://recordings.example.test/class-1-again',
      courseId,
    });
    expect(response.status).toBe(409);
    expect(problemCode(response)).toBe('recording_exists');
  });

  it('withdraws future classes when a series ends, keeping the ones already taught', async () => {
    const before = await prisma.liveSession.count({ where: { seriesId } });
    const past = await prisma.liveSession.count({
      where: { seriesId, startsAt: { lt: new Date() } },
    });
    const response = expectStatus(await admin.delete(`/series/${seriesId}`), 200);
    const removed = (response.body as { removed: number }).removed;
    const after = await prisma.liveSession.count({ where: { seriesId } });
    expect(after).toBe(before - removed);
    expect(after).toBeGreaterThanOrEqual(past);

    const list = expectStatus(await admin.get(`/batches/${batchId}/series`), 200)
      .body as SessionSeriesSummary[];
    expect(list.find((s) => s.id === seriesId)?.active).toBe(false);
  });
});
