import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type {
  AttendanceMarkResult,
  AttendanceSessionRow,
  Paginated,
  ProgressOverview,
  SessionAttendanceView,
  StudentAttendanceView,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

/**
 * J-05: a class ends, the trainer takes the roll call, corrects one mark the next day with a
 * reason, and the figures follow through to the learner's own page and to the reports.
 * Covers AC-05.1 (one call marks the whole roster), AC-05.2 (a correction records who, when and
 * why) and AC-05.3 (the percentage follows the stated formula).
 */
describe('attendance', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let trainer: Session;
  let student: Session;
  const password = inject('password');

  let batchId = '';
  let otherBatchId = '';
  let sessionId = '';
  let futureSessionId = '';
  let otherSessionId = '';
  let studentId = '';
  let roster: { studentId: string }[] = [];

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
    studentId = (
      await prisma.studentProfile.findFirstOrThrow({
        where: { user: { email: TEST_ACCOUNTS.student.email } },
      })
    ).id;
    roster = await prisma.batchMember.findMany({
      where: { batchId, isActive: true },
      select: { studentId: true },
    });

    const hourAgo = new Date(Date.now() - 3 * 3_600_000);
    const finished = await prisma.liveSession.create({
      data: {
        batchId,
        subject: 'core-java',
        title: 'Inheritance',
        startsAt: hourAgo,
        endsAt: new Date(hourAgo.getTime() + 3_600_000),
        status: 'completed',
      },
    });
    sessionId = finished.id;

    const tomorrow = new Date(Date.now() + 24 * 3_600_000);
    const upcoming = await prisma.liveSession.create({
      data: {
        batchId,
        subject: 'core-java',
        title: 'Interfaces',
        startsAt: tomorrow,
        endsAt: new Date(tomorrow.getTime() + 3_600_000),
        status: 'scheduled',
      },
    });
    futureSessionId = upcoming.id;

    const elsewhere = await prisma.liveSession.create({
      data: {
        batchId: otherBatchId,
        subject: 'sql',
        title: 'Joins',
        startsAt: hourAgo,
        endsAt: new Date(hourAgo.getTime() + 3_600_000),
        status: 'completed',
      },
    });
    otherSessionId = elsewhere.id;
  });

  afterAll(async () => {
    await prisma.attendanceRecord.deleteMany({
      where: { sessionId: { in: [sessionId, otherSessionId] } },
    });
    await prisma.liveSession.deleteMany({
      where: { id: { in: [sessionId, futureSessionId, otherSessionId] } },
    });
    await app.close();
  });

  it('offers the whole roster with nothing marked yet, and says the default is present', async () => {
    const view = expectStatus(await trainer.get(`/sessions/${sessionId}/attendance`), 200)
      .body as SessionAttendanceView;

    expect(view.students).toHaveLength(roster.length);
    expect(view.students.every((row) => row.status === null)).toBe(true);
    expect(view.canMark).toBe(true);
    expect(view.markedAt).toBeNull();
    expect(view.rules.defaultStatus).toBe('present');
    expect(view.rules.countedStatuses).toContain('present');
  });

  it('refuses to mark a class that has not happened yet', async () => {
    const response = await trainer.put(`/sessions/${futureSessionId}/attendance`, {
      records: [{ studentId, status: 'present' }],
    });
    expectStatus(response, 422);
    expect(problemCode(response)).toBe('session_not_started');
  });

  it('marks the whole roster in one call (AC-05.1)', async () => {
    const records = roster.map((member, index) => ({
      studentId: member.studentId,
      // One absentee, so the figures are not all the same.
      status: index === 0 && member.studentId !== studentId ? 'absent' : 'present',
    }));
    const result = expectStatus(
      await trainer.put(`/sessions/${sessionId}/attendance`, { records }),
      200,
    ).body as AttendanceMarkResult;

    expect(result.marked).toBe(roster.length);
    expect(result.corrected).toBe(0);

    const view = expectStatus(await trainer.get(`/sessions/${sessionId}/attendance`), 200)
      .body as SessionAttendanceView;
    expect(view.markedAt).not.toBeNull();
    expect(view.markedByName).toBe(TEST_ACCOUNTS.trainer.name);
    expect(view.correctionWindowEndsAt).not.toBeNull();
    expect(view.withinCorrectionWindow).toBe(true);
  });

  it('refuses a correction that does not say why (AC-05.2)', async () => {
    const response = await trainer.put(`/sessions/${sessionId}/attendance`, {
      records: [{ studentId, status: 'late' }],
    });
    expectStatus(response, 422);
    expect(problemCode(response)).toBe('reason_required');
  });

  it('records who corrected a mark, when and why (AC-05.2)', async () => {
    const result = expectStatus(
      await trainer.put(`/sessions/${sessionId}/attendance`, {
        records: [{ studentId, status: 'late' }],
        reason: 'Arrived twenty minutes in after a train delay.',
      }),
      200,
    ).body as AttendanceMarkResult;
    expect(result.corrected).toBe(1);
    expect(result.marked).toBe(0);

    const view = expectStatus(await trainer.get(`/sessions/${sessionId}/attendance`), 200)
      .body as SessionAttendanceView;
    const row = view.students.find((s) => s.studentId === studentId);
    expect(row?.status).toBe('late');
    expect(row?.correctedByName).toBe(TEST_ACCOUNTS.trainer.name);
    expect(row?.correctedAt).not.toBeNull();
    expect(row?.correctionReason).toContain('train delay');

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'attendance.corrected' },
      orderBy: { occurredAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect((audit?.before as { status?: string } | null)?.status).toBe('present');
    expect((audit?.after as { status?: string } | null)?.status).toBe('late');
  });

  it('reports the same marks back to the learner, with the percentage (AC-05.3)', async () => {
    const view = expectStatus(await student.get('/me/attendance'), 200)
      .body as StudentAttendanceView;

    expect(view.summary.conducted).toBeGreaterThan(0);
    // "Late" counts as attended by default, so one attended class out of one is 100 per cent.
    expect(view.summary.attended).toBe(view.summary.conducted);
    expect(view.summary.percentage).toBe(100);
    expect(view.summary.counts.late).toBe(1);
    expect(view.bySubject.some((row) => row.subject === 'core-java')).toBe(true);
    expect(view.days.length).toBeGreaterThan(0);
  });

  it('shows the learner their attendance on the progress page', async () => {
    const overview = expectStatus(await student.get('/me/progress'), 200).body as ProgressOverview;
    expect(overview.attendance).not.toBeNull();
    expect(overview.attendance?.percentage).toBe(100);
    // Nothing on the progress page is unmeasurable any more.
    expect(overview.pending).toEqual([]);
  });

  it('lists the class as marked, and a trainer sees only their own batches', async () => {
    const marked = expectStatus(await trainer.get('/attendance/sessions?state=marked'), 200)
      .body as Paginated<AttendanceSessionRow>;
    const row = marked.data.find((entry) => entry.sessionId === sessionId);
    expect(row?.isMarked).toBe(true);
    expect(row?.markedCount).toBe(roster.length);
    expect(row?.percentage).not.toBeNull();

    expect(marked.data.some((entry) => entry.batchId === otherBatchId)).toBe(false);
    const forbidden = await trainer.get(`/sessions/${otherSessionId}/attendance`);
    expectStatus(forbidden, 403);
  });

  it('lets an administrator mark a class in any batch', async () => {
    const otherRoster = await prisma.batchMember.findMany({
      where: { batchId: otherBatchId, isActive: true },
      select: { studentId: true },
    });
    const result = expectStatus(
      await admin.put(`/sessions/${otherSessionId}/attendance`, {
        records: otherRoster.map((member) => ({ studentId: member.studentId, status: 'present' })),
      }),
      200,
    ).body as AttendanceMarkResult;
    expect(result.marked).toBe(otherRoster.length);
  });

  it('refuses a mark for somebody who is not in the batch', async () => {
    const stranger = await prisma.studentProfile.findFirstOrThrow({
      where: { members: { none: { batchId, isActive: true } } },
    });
    const response = await trainer.put(`/sessions/${sessionId}/attendance`, {
      records: [{ studentId: stranger.id, status: 'present' }],
      reason: 'Testing the guard.',
    });
    expectStatus(response, 422);
    expect(problemCode(response)).toBe('not_in_batch');
  });

  it('refuses a correction once the window has closed, unless you may manage attendance', async () => {
    // Move the roll call back beyond the correction window (48 hours by default).
    await prisma.liveSession.update({
      where: { id: sessionId },
      data: { attendanceMarkedAt: new Date(Date.now() - 72 * 3_600_000) },
    });

    const refused = await trainer.put(`/sessions/${sessionId}/attendance`, {
      records: [{ studentId, status: 'absent' }],
      reason: 'Trying after the window.',
    });
    expectStatus(refused, 403);
    expect(problemCode(refused)).toBe('correction_window_closed');

    const view = expectStatus(await trainer.get(`/sessions/${sessionId}/attendance`), 200)
      .body as SessionAttendanceView;
    expect(view.canMark).toBe(false);
    expect(view.blockedReason).toContain('administrator');

    // An administrator holds attendance:manage, so the same change is allowed.
    expectStatus(
      await admin.put(`/sessions/${sessionId}/attendance`, {
        records: [{ studentId, status: 'excused' }],
        reason: 'Medical certificate produced afterwards.',
      }),
      200,
    );
    const after = expectStatus(await admin.get(`/sessions/${sessionId}/attendance`), 200)
      .body as SessionAttendanceView;
    expect(after.students.find((s) => s.studentId === studentId)?.status).toBe('excused');
  });

  it('refuses a learner the roll call for their own class', async () => {
    expectStatus(await student.get(`/sessions/${sessionId}/attendance`), 403);
    expectStatus(
      await student.put(`/sessions/${sessionId}/attendance`, {
        records: [{ studentId, status: 'present' }],
      }),
      403,
    );
  });
});
