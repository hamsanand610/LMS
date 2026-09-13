import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type { ImportJobResult, StudentDetail, StudentSummary } from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { createTestApp } from './setup/app.js';
import { problemCode, Session } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

/** J-01 (admin creates a student) plus the rules around student records. */
describe('students', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let trainer: Session;
  const password = inject('password');
  const unique = Date.now();

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = new Session(app);
    trainer = new Session(app);
    expect((await admin.login(TEST_ACCOUNTS.admin.email, password)).status).toBe(200);
    expect((await trainer.login(TEST_ACCOUNTS.trainer.email, password)).status).toBe(200);
  });
  afterAll(async () => {
    await app.close();
  });

  it('J-01: creating a student makes an invited account, a student code and an invitation', async () => {
    const email = `j01-${unique}@test.local`;
    const response = await admin.post('/students', {
      name: 'Journey One',
      email,
      mobile: `+9198${String(unique).slice(-8)}`,
      sendInvitation: true,
    });
    expect(response.status).toBe(201);
    const student = response.body as StudentSummary;
    expect(student.studentCode).toMatch(/^STU-\d{4}-\d{4}$/);
    expect(student.accountStatus).toBe('invited');
    expect(student.status).toBe('enrolled');

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const invitation = await prisma.invitation.findFirst({
      where: { userId: user.id, acceptedAt: null },
    });
    expect(invitation, 'an invitation is issued so the student can set a password').not.toBeNull();
    const roles = await prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: true },
    });
    expect(roles.map((r) => r.role.key)).toEqual(['student']);
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'students.created', resourceId: student.id },
    });
    expect(audit?.summary).toContain(student.studentCode);
  });

  it('refuses a second student with the same email', async () => {
    const email = `dup-${unique}@test.local`;
    expect((await admin.post('/students', { name: 'First Person', email })).status).toBe(201);
    const second = await admin.post('/students', { name: 'Second Person', email });
    expect(second.status).toBe(409);
    expect(problemCode(second)).toBe('email_taken');
  });

  it('validates the input before creating anything', async () => {
    const bad = await admin.post('/students', { name: 'X', email: 'not-an-email' });
    expect(bad.status).toBe(400);
    const paths = (bad.body.errors as { path: string }[]).map((e) => e.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email']));
  });

  it('allocates student codes in sequence', async () => {
    const first = (
      await admin.post('/students', { name: 'Code One', email: `code1-${unique}@test.local` })
    ).body as StudentSummary;
    const second = (
      await admin.post('/students', { name: 'Code Two', email: `code2-${unique}@test.local` })
    ).body as StudentSummary;
    const sequence = (code: string) => Number(code.slice(-4));
    expect(sequence(second.studentCode)).toBe(sequence(first.studentCode) + 1);
  });

  it('hides personal details from a caller without students:read_sensitive', async () => {
    const list = await trainer.get('/students');
    expect(list.status).toBe(200);
    const own = (list.body.data as StudentSummary[]).find(
      (s) => s.email === TEST_ACCOUNTS.student.email,
    );
    expect(own, 'the trainer sees the student of their own batch').toBeDefined();

    const asTrainer = await trainer.get(`/students/${own!.id}`);
    expect(asTrainer.status).toBe(200);
    const trainerView = asTrainer.body as StudentDetail;
    expect(trainerView.sensitiveVisible).toBe(false);
    expect(trainerView.personal.dateOfBirth).toBeUndefined();
    expect(trainerView.personal.guardianName).toBeUndefined();
    expect(trainerView.personal.city, 'non-sensitive fields stay visible').toBe('Chennai');

    const asAdmin = await admin.get(`/students/${own!.id}`);
    const adminView = asAdmin.body as StudentDetail;
    expect(adminView.sensitiveVisible).toBe(true);
    expect(adminView.personal.dateOfBirth).toBe('2004-05-05');
  });

  it('keeps a batch-scoped trainer away from students of other batches', async () => {
    const other = await prisma.studentProfile.findFirstOrThrow({
      where: { user: { email: TEST_ACCOUNTS.lockout.email } },
    });
    const response = await trainer.get(`/students/${other.id}`);
    // Out of scope reads as "not found" so the record's existence is not leaked.
    expect(response.status).toBe(404);
    const list = await trainer.get('/students?pageSize=100');
    expect((list.body.data as StudentSummary[]).map((s) => s.id)).not.toContain(other.id);
  });

  it('refuses a trainer any write to student records', async () => {
    expect(
      (await trainer.post('/students', { name: 'Nope', email: `nope-${unique}@test.local` }))
        .status,
    ).toBe(403);
    const own = await prisma.studentProfile.findFirstOrThrow({
      where: { user: { email: TEST_ACCOUNTS.student.email } },
    });
    expect((await trainer.patch(`/students/${own.id}`, { summary: 'edited' })).status).toBe(403);
  });

  it('follows the status state machine and audits every move', async () => {
    const student = (
      await admin.post('/students', {
        name: 'Status Person',
        email: `status-${unique}@test.local`,
        status: 'prospect',
      })
    ).body as StudentSummary;
    const invalid = await admin.post(`/students/${student.id}/status`, { status: 'alumni' });
    expect(invalid.status).toBe(409);
    expect(problemCode(invalid)).toBe('invalid_transition');

    expect(
      (await admin.post(`/students/${student.id}/status`, { status: 'enrolled' })).status,
    ).toBe(201);
    const active = await admin.post(`/students/${student.id}/status`, {
      status: 'active',
      reason: 'Joined',
    });
    expect(active.status).toBe(201);
    expect((active.body as StudentSummary).status).toBe('active');
    const audit = await prisma.auditLog.count({
      where: { action: 'students.status_changed', resourceId: student.id },
    });
    expect(audit).toBe(2);
  });

  it('records staff notes against a student', async () => {
    const student = (
      await admin.post('/students', { name: 'Note Person', email: `note-${unique}@test.local` })
    ).body as StudentSummary;
    const note = await admin.post(`/students/${student.id}/notes`, {
      text: 'Called about attendance.',
    });
    expect(note.status).toBe(201);
    const notes = await admin.get(`/students/${student.id}/notes`);
    expect((notes.body as { text: string }[])[0]?.text).toBe('Called about attendance.');
  });

  it('imports a sheet, reports the bad rows and creates the good ones', async () => {
    const header = 'name,email,mobile,batchCode,status,city';
    const rows = [
      `Import One,import1-${unique}@test.local,+9197${String(unique).slice(-8)},${TEST_FIXTURES.assignedBatchCode},enrolled,Chennai`,
      `Import Two,import2-${unique}@test.local,,,enrolled,Madurai`,
      `Bad Email,not-an-email,,,enrolled,Chennai`,
      `,import3-${unique}@test.local,,,enrolled,Chennai`,
      `Unknown Batch,import4-${unique}@test.local,,ZZZ-0000,enrolled,Chennai`,
    ];
    const response = await admin.post('/students/import', {
      content: `${header}\n${rows.join('\n')}\n`,
      filename: 'sample.csv',
      sendInvitations: false,
    });
    expect(response.status).toBe(201);
    const job = response.body as ImportJobResult;
    expect(job.total).toBe(5);
    expect(job.created).toBe(2);
    expect(job.failed, 'three rows cannot be used at all').toBe(3);
    expect(job.skipped, 'no row names an account that already exists').toBe(0);
    expect(job.errors.map((e) => e.column)).toEqual(
      expect.arrayContaining(['email', 'name', 'batchCode']),
    );
    for (const error of job.errors) expect(error.row).toBeGreaterThan(1);

    const imported = await prisma.user.findUnique({
      where: { email: `import1-${unique}@test.local` },
    });
    expect(imported).not.toBeNull();
    const member = await prisma.batchMember.findFirst({
      where: { student: { user: { email: `import1-${unique}@test.local` } }, isActive: true },
      include: { batch: true },
    });
    expect(member?.batch.code, 'batchCode from the sheet places the student').toBe(
      TEST_FIXTURES.assignedBatchCode,
    );
  });

  it('writes nothing on a dry run', async () => {
    const email = `dry-${unique}@test.local`;
    const response = await admin.post('/students/import', {
      content: `name,email\nDry Run,${email}\n`,
      filename: 'dry.csv',
      dryRun: true,
      sendInvitations: false,
    });
    expect((response.body as ImportJobResult).created).toBe(1);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it('rejects a sheet without the required columns', async () => {
    const response = await admin.post('/students/import', {
      content: 'firstname,surname\nA,B\n',
      filename: 'wrong.csv',
    });
    expect(response.status).toBe(400);
    expect(response.body.detail, 'the message names the column that is missing').toMatch(/name/);
    expect((response.body.errors as { path: string }[])[0]?.path).toBe('content');
  });

  it('offers a template whose header matches what the importer accepts', async () => {
    const response = await admin.get('/students/import/template');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/csv/);
    const [header] = response.text.split('\n');
    expect(header).toContain('name,email');
    const probe = await admin.post('/students/import', {
      content: response.text,
      filename: 'template.csv',
      dryRun: true,
    });
    expect(probe.status).toBe(201);
    expect((probe.body as ImportJobResult).errors).toEqual([]);
  });
});
