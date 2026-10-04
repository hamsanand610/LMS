import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { SYSTEM_ROLES } from '@lms/shared';
import { AuthContextService } from '../src/core/auth/auth-context.service.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { AnnouncementsService } from '../src/modules/notifications/announcements.service.js';
import { ExportsService } from '../src/modules/reports/exports.service.js';
import { StudentImportService } from '../src/modules/students/import.service.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus } from './setup/http.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

/**
 * Phase 6: what two requests, or a request and a job, do at the same moment — and what a job
 * queued by someone does once that person may no longer do it.
 */
describe('concurrency and queued work (Phase 6)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let organizationId = '';
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  let counter = 0;

  async function person(roleKey: string, label: string) {
    counter += 1;
    const role = await prisma.role.findFirstOrThrow({ where: { organizationId, key: roleKey } });
    const email = `p6-race-${label}-${counter}-${unique}@test.local`;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `Race ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
      },
    });
    return { id: user.id, email };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    organizationId = (
      await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.superAdmin.email } })
    ).organizationId;
    admin = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
  });
  afterAll(async () => {
    await app.close();
  });

  it('keeps one Super Admin when the last two remove each other at the same moment', async () => {
    const one = await person(SYSTEM_ROLES.SUPER_ADMIN, 'super');
    const two = await person(SYSTEM_ROLES.SUPER_ADMIN, 'super');
    const [first, second] = [new Session(app), new Session(app)];
    expectStatus(await first.login(one.email, password), 200);
    expectStatus(await second.login(two.email, password), 200);
    // For the length of the test the seeded Super Admin does not count, so these two are the last.
    const seeded = await prisma.user.findUniqueOrThrow({
      where: { email: TEST_ACCOUNTS.superAdmin.email },
    });
    await prisma.user.update({ where: { id: seeded.id }, data: { status: 'suspended' } });
    try {
      await Promise.all([
        first.put(`/users/${two.id}/roles`, { roleKeys: [SYSTEM_ROLES.ADMIN] }),
        second.put(`/users/${one.id}/roles`, { roleKeys: [SYSTEM_ROLES.ADMIN] }),
      ]);
      const remaining = await prisma.user.count({
        where: {
          id: { in: [one.id, two.id] },
          status: 'active',
          roles: { some: { role: { key: SYSTEM_ROLES.SUPER_ADMIN } } },
        },
      });
      expect(remaining).toBe(1);
    } finally {
      await prisma.user.update({ where: { id: seeded.id }, data: { status: 'active' } });
      app.get(AuthContextService).invalidate(seeded.id);
    }
  });

  it('builds no export for someone switched off after asking for it', async () => {
    const staff = await person(SYSTEM_ROLES.ADMIN, 'export');
    const record = await prisma.reportExport.create({
      data: {
        organizationId,
        report: 'attendance',
        format: 'csv',
        status: 'queued',
        filename: 'attendance.csv',
        requestedById: staff.id,
      },
    });
    expectStatus(await admin.post(`/users/${staff.id}/deactivate`, { reason: 'Left' }), 204);
    await app.get(ExportsService).run(record.id, staff.id);
    const after = await prisma.reportExport.findUniqueOrThrow({ where: { id: record.id } });
    expect(after.status).toBe('failed');
    expect(after.objectKey).toBe('');
    expect(after.error).toMatch(/can no longer export/);
  });

  it('creates nobody from an import whose sender was switched off before it ran', async () => {
    const staff = await person(SYSTEM_ROLES.ADMIN, 'import');
    const email = `p6-imported-${unique}@test.local`;
    const job = await prisma.importJob.create({
      data: {
        organizationId,
        type: 'students',
        status: 'queued',
        filename: 'students.csv',
        params: {
          content: `name,email\nImported Learner,${email}\n`,
          batchId: null,
          sendInvitations: false,
        },
        requestedById: staff.id,
      },
    });
    expectStatus(await admin.post(`/users/${staff.id}/deactivate`, { reason: 'Left' }), 204);
    await app.get(StudentImportService).run(job.id, staff.id);
    const after = await prisma.importJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.status).toBe('failed');
    expect(await prisma.user.count({ where: { email } })).toBe(0);
  });

  it('delivers an announcement once when it is sent twice at the same moment', async () => {
    const learner = await person(SYSTEM_ROLES.STUDENT, 'announce');
    const row = await prisma.announcement.create({
      data: {
        organizationId,
        title: `Once ${unique}`,
        body: 'Only once',
        audience: { roleKeys: [], batchIds: [], programIds: [] },
        startsAt: new Date(Date.now() - 1000),
        channels: ['in_app'],
        status: 'scheduled',
      },
    });
    const announcements = app.get(AnnouncementsService);
    await Promise.all([announcements.dispatch(row.id), announcements.dispatch(row.id)]);
    const notices = await prisma.notification.count({
      where: {
        userId: learner.id,
        type: 'announcement.published',
        data: { path: ['announcementId'], equals: row.id },
      },
    });
    expect(notices).toBe(1);
    const after = await prisma.announcement.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.deliveredAt).not.toBeNull();
    expect(after.recipientCount).toBeGreaterThan(0);
  });

  it('numbers learners past 9999 and past codes of another shape', async () => {
    const year = new Date().getFullYear();
    const placeholder = await person(SYSTEM_ROLES.STUDENT, 'code-high');
    const odd = await person(SYSTEM_ROLES.STUDENT, 'code-odd');
    const codes: string[] = [];
    try {
      await prisma.studentProfile.create({
        data: { userId: placeholder.id, studentCode: `STU-${year}-9999`, status: 'active' },
      });
      await prisma.studentProfile.create({
        data: { userId: odd.id, studentCode: `STU-${year}-ZZ-${unique}`, status: 'active' },
      });
      for (const n of [1, 2]) {
        const res = expectStatus(
          await admin.post('/students', {
            name: `Numbered ${n}`,
            email: `p6-numbered-${n}-${unique}@test.local`,
            sendInvitation: false,
          }),
          201,
        );
        codes.push((res.body as { studentCode: string }).studentCode);
      }
      const numbers = codes.map((code) => Number(code.split('-')[2]));
      expect(numbers[0]).toBeGreaterThanOrEqual(10_000);
      expect(numbers[1]).toBe(numbers[0]! + 1);
    } finally {
      // The year's numbering is shared by every later test file in the run: the codes this test
      // pushed past 9999 leave the sequence again (renamed to a test-only shape), so the next
      // learner anyone creates is numbered as if this test had never run (Phase 7F; J-01 asserts
      // the ordinary four-digit code).
      for (const [index, code] of [`STU-${year}-9999`, ...codes].entries()) {
        await prisma.studentProfile.updateMany({
          where: { studentCode: code },
          data: { studentCode: `STU-P6-NUM-${index}-${unique}` },
        });
      }
    }
  });
});
