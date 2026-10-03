import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { SYSTEM_ROLES, type CourseSummary } from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { JobsService } from '../src/core/queue/jobs.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { CertificatesService } from '../src/modules/certificates/certificates.service.js';
import { EnrollmentService } from '../src/modules/progress/enrollment.service.js';
import {
  RECONCILE_CRON,
  RECONCILE_JOB,
  ReconciliationService,
} from '../src/modules/progress/reconciliation.service.js';
import { createTestApp } from './setup/app.js';
import { eventually } from './setup/eventually.js';
import { Session, expectStatus } from './setup/http.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

/**
 * Phase 5: effects that follow a request — enrolments derived when a batch changes, places ended
 * with an account, certificates issued on completion — are re-derived from the records by a job,
 * so a handler that died with its process leaves nothing wrong for long. Each case below makes the
 * drift a lost event would leave, directly in the database, and asks the job to settle it: once,
 * twice, twice at the same moment, and with one learner failing.
 */
describe('reconciliation of asynchronous effects', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let reconcile: ReconciliationService;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);

  let organizationId = '';
  let batchId = '';
  let courseId = '';
  let elsewhereId = '';
  const courses: string[] = [];
  const people: Record<string, { userId: string; studentId: string }> = {};

  async function learner(label: string): Promise<{ userId: string; studentId: string }> {
    const role = await prisma.role.findFirstOrThrow({
      where: { organizationId, key: SYSTEM_ROLES.STUDENT },
    });
    const user = await prisma.user.create({
      data: {
        organizationId,
        email: `recon-${label}-${unique}@test.local`,
        name: `Reconcile ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
      },
    });
    const profile = await prisma.studentProfile.create({
      data: { userId: user.id, studentCode: `STU-RECON-${label}-${unique}`, status: 'active' },
    });
    return { userId: user.id, studentId: profile.id };
  }

  async function course(name: string, scopeId: string): Promise<string> {
    const id = (
      expectStatus(
        await admin.post('/courses', { title: `${name} ${unique}`, level: 'beginner' }),
        201,
      ).body as CourseSummary
    ).id;
    courses.push(id);
    expectStatus(
      await admin.put(`/courses/${id}/outline`, {
        modules: [
          {
            title: 'Basics',
            unlockRule: { type: 'always' },
            lessons: [{ title: 'Only part', type: 'article', content: { html: '<p>Hi</p>' } }],
          },
        ],
      }),
      200,
    );
    expectStatus(await admin.post(`/courses/${id}/publish`, { scopeType: 'batch', scopeId }), 201);
    return id;
  }

  const status = async (who: string, course: string) =>
    (
      await prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: people[who]!.studentId, courseId: course } },
      })
    )?.status ?? null;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    reconcile = app.get(ReconciliationService);
    organizationId = (await prisma.organization.findFirstOrThrow()).id;
    admin = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);

    const programId = (
      expectStatus(
        await admin.post('/programs', {
          code: `RECON-${unique}`,
          name: `Reconcile programme ${unique}`,
          durationWeeks: 12,
        }),
        201,
      ).body as { id: string }
    ).id;
    const batch = async (code: string) =>
      (
        expectStatus(
          await admin.post('/batches', {
            programId,
            code: `RECON-${unique}-${code}`,
            name: `Reconcile ${code}`,
            startDate: '2026-01-05',
            endDate: '2026-12-18',
          }),
          201,
        ).body as { id: string }
      ).id;
    batchId = await batch('B1');
    const elsewhere = await batch('B2');
    for (const label of ['missing', 'stray', 'finished', 'deactivated', 'first', 'second']) {
      people[label] = await learner(label);
    }
    expectStatus(
      await admin.post(`/batches/${batchId}/members`, {
        studentIds: Object.values(people).map((p) => p.studentId),
      }),
      201,
    );
    courseId = await course('Reconciled course', batchId);
    elsewhereId = await course('Elsewhere course', elsewhere);

    // The finished learner completes the course, which issues their certificate.
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { module: { courseId } } });
    const finished = new Session(app);
    expectStatus(await finished.login(`recon-finished-${unique}@test.local`, password), 200);
    expectStatus(await finished.post(`/lessons/${lesson.id}/complete`), 201);
    // The certificate follows the completion event, just after the response.
    expect(
      await eventually(
        () => prisma.certificate.count({ where: { studentId: people.finished!.studentId } }),
        (count) => count === 1,
      ),
    ).toBe(1);
    // Settle whatever earlier specs left, so the counts below are this spec's own.
    await reconcile.run();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    for (const id of courses) await admin.delete(`/courses/${id}`);
    await app.close();
  });

  it('is scheduled, so a restart is followed by a run', () => {
    const registrations = (
      app.get(JobsService) as unknown as { registrations: { name: string; cron?: string }[] }
    ).registrations;
    expect(registrations.find((r) => r.name === RECONCILE_JOB)?.cron).toBe(RECONCILE_CRON);
  });

  it('settles the drift lost events leave behind, and records that it did', async () => {
    const { finished, missing, stray, deactivated } = people as Record<
      string,
      { userId: string; studentId: string }
    >;
    // A lost "joined" event: an enrolment never derived.
    await prisma.enrollment.delete({
      where: { studentId_courseId: { studentId: missing!.studentId, courseId } },
    });
    // A lost "left" event: an open course that no publication justifies.
    await prisma.enrollment.create({
      data: { studentId: stray!.studentId, courseId: elsewhereId, source: 'batch' },
    });
    // A finished course withdrawn by the rule before L4.
    await prisma.enrollment.update({
      where: { studentId_courseId: { studentId: finished!.studentId, courseId } },
      data: { status: 'withdrawn' },
    });
    // A deactivation whose handlers never ran.
    await prisma.user.update({
      where: { id: deactivated!.userId },
      data: { status: 'deactivated' },
    });
    // A certificate whose issue job was lost.
    await prisma.certificate.deleteMany({ where: { studentId: finished!.studentId } });
    const audits = await prisma.auditLog.count({ where: { action: 'progress.reconciled' } });

    const report = await reconcile.run();
    expect(report.failed).toBe(0);
    expect(report.placesEnded).toBe(1);
    expect(report.added).toBe(1);
    // The stray course; the deactivated learner's course goes with their place, as on a removal.
    expect(report.withdrawn).toBe(1);
    expect(report.completedKept).toBe(1);
    expect(await status('missing', courseId)).toBe('active');
    expect(await status('stray', elsewhereId)).toBe('withdrawn');
    expect(await status('finished', courseId)).toBe('completed');
    expect(await status('deactivated', courseId)).toBe('withdrawn');
    expect(
      await prisma.batchMember.count({
        where: { studentId: deactivated!.studentId, isActive: true },
      }),
    ).toBe(0);
    expect(
      await prisma.auditLog.count({
        where: { action: 'batches.member_removed', summary: { contains: 'deactivated' } },
      }),
    ).toBeGreaterThan(0);
    expect(await prisma.auditLog.count({ where: { action: 'progress.reconciled' } })).toBe(
      audits + 1,
    );

    // The certificates sweep issues what the lost job did not, once, with one notice.
    const certificates = app.get(CertificatesService);
    await certificates.sweep();
    expect(await prisma.certificate.count({ where: { studentId: finished!.studentId } })).toBe(1);
    expect(
      await prisma.notification.count({
        where: { userId: finished!.userId, type: 'certificate.issued' },
      }),
    ).toBe(2);
  });

  it('changes nothing the second time, alone or run twice at once', async () => {
    const snapshot = async () => ({
      enrolments: await prisma.enrollment.count(),
      withdrawn: await prisma.enrollment.count({ where: { status: 'withdrawn' } }),
      places: await prisma.batchMember.count({ where: { isActive: true } }),
      certificates: await prisma.certificate.count(),
      notices: await prisma.notification.count(),
      audits: await prisma.auditLog.count({ where: { action: 'progress.reconciled' } }),
    });
    const before = await snapshot();
    const again = await reconcile.run();
    expect(again).toMatchObject({
      placesEnded: 0,
      completedKept: 0,
      withdrawn: 0,
      returned: 0,
      added: 0,
      failed: 0,
    });
    await app.get(CertificatesService).sweep();
    expect(await snapshot()).toEqual(before);

    // The same drift settled by two runs at the same moment: one enrolment, no error.
    await prisma.enrollment.delete({
      where: {
        studentId_courseId: { studentId: people.missing!.studentId, courseId },
      },
    });
    const [one, two] = await Promise.all([reconcile.run(), reconcile.run()]);
    expect(one.failed + two.failed).toBe(0);
    expect(
      await prisma.enrollment.count({
        where: { studentId: people.missing!.studentId, courseId },
      }),
    ).toBe(1);
    expect(await status('missing', courseId)).toBe('active');
    expect(await prisma.certificate.count()).toBe(before.certificates);
    expect(await prisma.notification.count()).toBe(before.notices);
  });

  it('settles everyone else when one learner fails, fails the job, and settles them on retry', async () => {
    const { first, second } = people as Record<string, { userId: string; studentId: string }>;
    for (const who of [first!, second!]) {
      await prisma.enrollment.delete({
        where: { studentId_courseId: { studentId: who.studentId, courseId } },
      });
    }
    const enrolments = app.get(EnrollmentService);
    const real = enrolments.reconcileStudent.bind(enrolments);
    const spy = vi.spyOn(enrolments, 'reconcileStudent').mockImplementation((studentId) => {
      if (studentId === first!.studentId) return Promise.reject(new Error('database went away'));
      return real(studentId);
    });

    await expect(reconcile.runJob()).rejects.toThrow(/1 learner\(s\) could not be reconciled/);
    expect(await status('first', courseId)).toBeNull();
    expect(await status('second', courseId)).toBe('active');
    expect(
      await prisma.auditLog.count({
        where: { action: 'progress.reconciled', summary: { contains: '1 failed' } },
      }),
    ).toBe(1);

    // The queue's retry: the database is back, and the run settles the rest.
    spy.mockRestore();
    const retried = await reconcile.runJob();
    expect(retried.failed).toBe(0);
    expect(retried.added).toBe(1);
    expect(await status('first', courseId)).toBe('active');
  });
});
