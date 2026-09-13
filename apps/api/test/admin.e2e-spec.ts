import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type {
  CustomFieldRecord,
  DashboardResponse,
  MeResponse,
  StudentDetail,
  StudentSummary,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { createTestApp } from './setup/app.js';
import { problemCode, Session } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

describe('dashboard, custom fields and identity', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: Session;
  let trainer: Session;
  let student: Session;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    superAdmin = new Session(app);
    trainer = new Session(app);
    student = new Session(app);
    expect((await superAdmin.login(TEST_ACCOUNTS.superAdmin.email, password)).status).toBe(200);
    expect((await trainer.login(TEST_ACCOUNTS.trainer.email, password)).status).toBe(200);
    expect((await student.login(TEST_ACCOUNTS.student.email, password)).status).toBe(200);
  });
  afterAll(async () => {
    await app.close();
  });

  it('counts people it can measure and states which tiles are still pending', async () => {
    const response = await superAdmin.get('/reports/dashboard');
    expect(response.status).toBe(200);
    const dashboard = response.body as DashboardResponse;
    const byKey = new Map(dashboard.metrics.map((m) => [m.key, m]));

    const total = byKey.get('students.total')!;
    expect(total.value).toBeGreaterThan(0);
    expect(total.pending).toBeNull();
    const attendance = byKey.get('attendance.percentage')!;
    expect(
      attendance.value,
      'no number is invented for a module that does not exist yet',
    ).toBeNull();
    expect(attendance.pending).toMatch(/Phase/);
    expect(dashboard.batches.length).toBeGreaterThan(0);
    expect(dashboard.asOf).toBeDefined();
  });

  it('scopes the dashboard to the batches a trainer teaches', async () => {
    const [all, mine] = await Promise.all([
      superAdmin.get('/reports/dashboard'),
      trainer.get('/reports/dashboard'),
    ]);
    const count = (body: DashboardResponse) =>
      body.metrics.find((m) => m.key === 'students.total')!.value ?? 0;
    expect(count(mine.body as DashboardResponse)).toBeLessThan(
      count(all.body as DashboardResponse),
    );
    const codes = (mine.body as DashboardResponse).batches.map((b) => b.code);
    expect(codes).toContain(TEST_FIXTURES.assignedBatchCode);
    expect(codes).not.toContain(TEST_FIXTURES.otherBatchCode);
  });

  it('refuses the dashboard to a student', async () => {
    expect((await student.get('/reports/dashboard')).status).toBe(403);
  });

  it('validates student records against the client custom fields', async () => {
    const key = `intake_${unique}`;
    const created = await superAdmin.post('/custom-fields', {
      entityType: 'student',
      key,
      label: 'Intake source',
      type: 'select',
      options: [
        { value: 'walk_in', label: 'Walk-in' },
        { value: 'referral', label: 'Referral' },
      ],
      required: false,
      position: 1,
    });
    expect(created.status).toBe(201);
    const field = created.body as CustomFieldRecord;

    const good = await superAdmin.post('/students', {
      name: 'Custom Field Person',
      email: `custom-${unique}@test.local`,
      custom: { [key]: 'referral' },
    });
    expect(good.status).toBe(201);
    const detail = await superAdmin.get(`/students/${(good.body as StudentSummary).id}`);
    expect((detail.body as StudentDetail).custom[key]).toBe('referral');

    const badValue = await superAdmin.post('/students', {
      name: 'Bad Value',
      email: `badvalue-${unique}@test.local`,
      custom: { [key]: 'unknown_source' },
    });
    expect(badValue.status).toBe(400);
    expect((badValue.body.errors as { path: string }[])[0]?.path).toBe(`custom.${key}`);

    const unknownKey = await superAdmin.post('/students', {
      name: 'Unknown Key',
      email: `badkey-${unique}@test.local`,
      custom: { not_a_field: 'x' },
    });
    expect(unknownKey.status).toBe(400);

    const removed = await superAdmin.delete(`/custom-fields/${field.id}`);
    expect(removed.status).toBe(204);
  });

  it('refuses a duplicate custom-field key', async () => {
    const key = `dupfield_${unique}`;
    const body = {
      entityType: 'student',
      key,
      label: 'Duplicate',
      type: 'text',
    };
    expect((await superAdmin.post('/custom-fields', body)).status).toBe(201);
    const second = await superAdmin.post('/custom-fields', body);
    expect(second.status).toBe(409);
    expect(problemCode(second)).toBe('field_taken');
  });

  it('needs at least one option for a choice field', async () => {
    const response = await superAdmin.post('/custom-fields', {
      entityType: 'student',
      key: `nooptions_${unique}`,
      label: 'No options',
      type: 'select',
      options: [],
    });
    expect(response.status).toBe(400);
    expect((response.body.errors as { path: string }[])[0]?.path).toBe('options');
  });

  it('tells the web shell who the signed-in person is', async () => {
    const asStudent = (await student.get('/me')).body as MeResponse;
    expect(asStudent.person.studentId).not.toBeNull();
    expect(asStudent.person.studentCode).toMatch(/^STU-/);
    expect(asStudent.person.trainerId).toBeNull();
    expect(asStudent.person.batchIds.length).toBe(1);

    const asTrainer = (await trainer.get('/me')).body as MeResponse;
    expect(asTrainer.person.trainerId).not.toBeNull();
    expect(asTrainer.person.studentId).toBeNull();
    expect(asTrainer.homePortal).toBe('trainer');
    const batch = await prisma.batch.findFirstOrThrow({
      where: { code: TEST_FIXTURES.assignedBatchCode },
    });
    expect(asTrainer.person.batchIds).toContain(batch.id);

    const asSuperAdmin = (await superAdmin.get('/me')).body as MeResponse;
    expect(asSuperAdmin.person.studentId).toBeNull();
    expect(asSuperAdmin.person.trainerId).toBeNull();
    expect(
      asSuperAdmin.navigation.admin.map((i) => i.key),
      'Phase 2 navigation reaches the new admin pages',
    ).toEqual(
      expect.arrayContaining([
        'admin.students',
        'admin.trainers',
        'admin.batches',
        'admin.programs',
        'admin.announcements',
      ]),
    );
  });
});
