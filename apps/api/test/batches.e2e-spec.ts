import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type {
  BatchDetail,
  BatchMemberRow,
  BatchSummary,
  ProgramSummary,
  StudentSummary,
  TrainerSummary,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { createTestApp } from './setup/app.js';
import { problemCode, Session } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

/** J-02 (admin creates a batch) as far as Phase 2 reaches: roster, trainers and status. */
describe('programmes and batches', () => {
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

  it('J-02: programme → batch → students → trainers → running, with a notification at the end', async () => {
    const program = (
      await admin.post('/programs', {
        code: `J2${unique}`.slice(0, 10),
        name: 'Journey Programme',
        durationWeeks: 16,
      })
    ).body as ProgramSummary;
    expect(program.id).toBeDefined();

    const batchResponse = await admin.post('/batches', {
      programId: program.id,
      code: `J2-${unique}-B1`,
      name: 'Journey Batch 1',
      mode: 'online',
      startDate: '2026-02-02',
      endDate: '2026-06-30',
      capacity: 5,
    });
    expect(batchResponse.status).toBe(201);
    const batch = batchResponse.body as BatchSummary;
    expect(batch.status).toBe('planned');
    expect(batch.studentCount).toBe(0);

    // A batch without students must not start.
    const tooEarly = await admin.post(`/batches/${batch.id}/status`, { status: 'running' });
    expect(tooEarly.status).toBe(422);
    expect(problemCode(tooEarly)).toBe('batch_empty');

    const newStudent = (
      await admin.post('/students', { name: 'Journey Student', email: `j2-${unique}@test.local` })
    ).body as StudentSummary;
    const added = await admin.post(`/batches/${batch.id}/members`, { studentIds: [newStudent.id] });
    expect(added.status).toBe(201);
    expect(added.body).toEqual({ added: 1 });

    const trainerRecord = await prisma.trainerProfile.findFirstOrThrow({
      where: { user: { email: TEST_ACCOUNTS.trainer.email } },
    });
    const assigned = await admin.put(`/batches/${batch.id}/trainers`, {
      assignments: [{ trainerId: trainerRecord.id, subject: 'Core Java', role: 'lead' }],
    });
    expect(assigned.status).toBe(200);
    expect((assigned.body as BatchDetail).trainers).toHaveLength(1);

    const running = await admin.post(`/batches/${batch.id}/status`, { status: 'running' });
    expect(running.status).toBe(201);
    expect((running.body as BatchDetail).status).toBe('running');

    // The member is told their batch has started (J-02 end state).
    const notification = await prisma.notification.findFirst({
      where: { user: { email: `j2-${unique}@test.local` }, type: 'batch.started' },
    });
    expect(notification?.title).toContain('Journey Batch 1');
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'batches.status_changed', resourceId: batch.id },
    });
    expect(audit?.summary).toContain('running');
  });

  it('refuses a duplicate batch code and an end date before the start', async () => {
    const program = await prisma.program.findFirstOrThrow({
      where: { code: TEST_FIXTURES.programCode },
    });
    const duplicate = await admin.post('/batches', {
      programId: program.id,
      code: TEST_FIXTURES.assignedBatchCode,
      name: 'Clash',
      startDate: '2026-01-01',
      endDate: '2026-02-01',
    });
    expect(duplicate.status).toBe(409);
    expect(problemCode(duplicate)).toBe('code_taken');

    const backwards = await admin.post('/batches', {
      programId: program.id,
      code: `BACK-${unique}`,
      name: 'Backwards',
      startDate: '2026-06-01',
      endDate: '2026-01-01',
    });
    expect(backwards.status).toBe(400);
    expect((backwards.body.errors as { path: string }[])[0]?.path).toBe('endDate');
  });

  it('enforces capacity when adding students', async () => {
    const program = await prisma.program.findFirstOrThrow({
      where: { code: TEST_FIXTURES.programCode },
    });
    const batch = (
      await admin.post('/batches', {
        programId: program.id,
        code: `CAP-${unique}`,
        name: 'Capacity Batch',
        startDate: '2026-03-01',
        endDate: '2026-09-01',
        capacity: 1,
      })
    ).body as BatchSummary;
    const first = (
      await admin.post('/students', { name: 'Cap One', email: `cap1-${unique}@test.local` })
    ).body as StudentSummary;
    const second = (
      await admin.post('/students', { name: 'Cap Two', email: `cap2-${unique}@test.local` })
    ).body as StudentSummary;
    expect(
      (await admin.post(`/batches/${batch.id}/members`, { studentIds: [first.id] })).status,
    ).toBe(201);
    const overflow = await admin.post(`/batches/${batch.id}/members`, { studentIds: [second.id] });
    expect(overflow.status).toBe(422);
    expect(problemCode(overflow)).toBe('capacity_exceeded');
  });

  it('keeps a leaving student in the roster history and frees the seat', async () => {
    const program = await prisma.program.findFirstOrThrow({
      where: { code: TEST_FIXTURES.programCode },
    });
    const batch = (
      await admin.post('/batches', {
        programId: program.id,
        code: `LEAVE-${unique}`,
        name: 'Leaver Batch',
        startDate: '2026-03-01',
        endDate: '2026-09-01',
        capacity: 2,
      })
    ).body as BatchSummary;
    const person = (
      await admin.post('/students', { name: 'Leaver', email: `leave-${unique}@test.local` })
    ).body as StudentSummary;
    await admin.post(`/batches/${batch.id}/members`, { studentIds: [person.id] });
    const removed = await admin.delete(`/batches/${batch.id}/members/${person.id}?reason=Withdrew`);
    expect(removed.status).toBe(204);

    const active = await admin.get(`/batches/${batch.id}/members`);
    expect((active.body.data as BatchMemberRow[]).length).toBe(0);
    const withHistory = await admin.get(`/batches/${batch.id}/members?includeInactive=true`);
    const history = withHistory.body.data as BatchMemberRow[];
    expect(history).toHaveLength(1);
    expect(history[0]?.isActive).toBe(false);
    expect(history[0]?.leftAt).not.toBeNull();
  });

  it('shows a trainer only the batches they are assigned to', async () => {
    const list = await trainer.get('/batches?pageSize=100');
    expect(list.status).toBe(200);
    const codes = (list.body.data as BatchSummary[]).map((b) => b.code);
    expect(codes).toContain(TEST_FIXTURES.assignedBatchCode);
    expect(codes).not.toContain(TEST_FIXTURES.otherBatchCode);

    const other = await prisma.batch.findFirstOrThrow({
      where: { code: TEST_FIXTURES.otherBatchCode },
    });
    expect((await trainer.get(`/batches/${other.id}`)).status).toBe(404);
    const own = await prisma.batch.findFirstOrThrow({
      where: { code: TEST_FIXTURES.assignedBatchCode },
    });
    const detail = await trainer.get(`/batches/${own.id}`);
    expect(detail.status).toBe(200);
    expect(
      (detail.body as BatchDetail).allowedTransitions,
      'a trainer may look but not move the batch on',
    ).toEqual([]);
  });

  it('refuses batch writes to a trainer and any access to a student', async () => {
    const own = await prisma.batch.findFirstOrThrow({
      where: { code: TEST_FIXTURES.assignedBatchCode },
    });
    expect((await trainer.patch(`/batches/${own.id}`, { name: 'Renamed' })).status).toBe(403);
    expect((await trainer.post(`/batches/${own.id}/status`, { status: 'completed' })).status).toBe(
      403,
    );
    expect((await student.get('/batches')).status).toBe(403);
    expect((await student.get('/programs')).status).toBe(403);
  });

  it('refuses to archive a programme that still has live batches', async () => {
    const program = await prisma.program.findFirstOrThrow({
      where: { code: TEST_FIXTURES.programCode },
    });
    const response = await admin.patch(`/programs/${program.id}`, { status: 'archived' });
    expect(response.status).toBe(422);
    expect(problemCode(response)).toBe('program_in_use');
  });

  it('lists trainers with their assignment counts', async () => {
    const response = await admin.get('/trainers');
    expect(response.status).toBe(200);
    const trainers = response.body.data as TrainerSummary[];
    const fixture = trainers.find((t) => t.email === TEST_ACCOUNTS.trainer.email);
    expect(fixture?.subjects).toContain('Core Java');
    expect(fixture?.batchCount).toBeGreaterThanOrEqual(1);
  });

  it('lets a trainer see only their own trainer record', async () => {
    const response = await trainer.get('/trainers');
    expect(response.status).toBe(200);
    const rows = response.body.data as TrainerSummary[];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe(TEST_ACCOUNTS.trainer.email);
  });
});
