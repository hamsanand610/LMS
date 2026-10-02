import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  SYSTEM_ROLES,
  type CourseDetail,
  type CourseStaffMember,
  type CourseSummary,
  type Paginated,
  type PublicationRecord,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { APPLIED_BUNDLE_CHANGES_KEY, syncSystemRoles } from '../src/modules/rbac/sync.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

const HOUR = 3_600_000;

/**
 * Phase 3, TRN-03 and ADR-0023: course staff. An administrator puts trainers in charge of a
 * course's content; they change it, publish it to the batches they teach and see it whole. A
 * trainer who is not on a course's staff changes nothing in it, whatever their batches have.
 */
describe('course staff', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let trainer: Session;
  let student: Session;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);

  let organizationId = '';
  let batchId = '';
  let otherBatchId = '';
  let programId = '';
  let trainerId = '';
  let staffedId = '';
  let notStaffedId = '';

  const outline = (lesson: string) => ({
    modules: [
      {
        title: 'Basics',
        unlockRule: { type: 'always' },
        lessons: [{ title: lesson, type: 'article', content: { html: '<p>Hello</p>' } }],
      },
    ],
  });

  async function course(title: string): Promise<string> {
    const created = expectStatus(
      await admin.post('/courses', { title, level: 'beginner', subject: 'core-java' }),
      201,
    ).body as CourseSummary;
    expectStatus(await admin.put(`/courses/${created.id}/outline`, outline('Welcome')), 200);
    return created.id;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    organizationId = (await prisma.organization.findFirstOrThrow()).id;
    admin = new Session(app);
    trainer = new Session(app);
    student = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.admin.email, password), 200);
    expectStatus(await trainer.login(TEST_ACCOUNTS.trainer.email, password), 200);
    expectStatus(await student.login(TEST_ACCOUNTS.student.email, password), 200);
    const batch = await prisma.batch.findUniqueOrThrow({
      where: { code: TEST_FIXTURES.assignedBatchCode },
    });
    batchId = batch.id;
    programId = batch.programId;
    otherBatchId = (
      await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.otherBatchCode } })
    ).id;
    trainerId = (
      await prisma.trainerProfile.findFirstOrThrow({
        where: { user: { email: TEST_ACCOUNTS.trainer.email } },
      })
    ).id;
    staffedId = await course(`Staffed course ${unique}`);
    notStaffedId = await course(`Not staffed ${unique}`);
    // A course the trainer's batch has, and which the trainer is not in charge of.
    expectStatus(
      await admin.post(`/courses/${notStaffedId}/publish`, {
        scopeType: 'batch',
        scopeId: batchId,
      }),
      201,
    );
  });

  afterAll(async () => {
    for (const id of [staffedId, notStaffedId]) {
      expectStatus(await admin.delete(`/courses/${id}`), 200);
    }
    await prisma.liveSession.deleteMany({ where: { title: { endsWith: unique } } });
    await app.close();
  });

  it('is put in place by an administrator, and by nobody else', async () => {
    expect(
      (await trainer.put(`/courses/${staffedId}/staff`, { trainerIds: [trainerId] })).status,
    ).toBe(403);
    expect(
      (await student.put(`/courses/${staffedId}/staff`, { trainerIds: [trainerId] })).status,
    ).toBe(403);
    const staff = expectStatus(
      await admin.put(`/courses/${staffedId}/staff`, { trainerIds: [trainerId] }),
      200,
    ).body as CourseStaffMember[];
    expect(staff).toEqual([{ trainerId, name: TEST_ACCOUNTS.trainer.name }]);
    const entry = await prisma.auditLog.findFirst({
      where: { action: 'course.staff_changed', resourceId: staffedId },
    });
    expect(entry?.after).toEqual([trainerId]);
    const unknown = await admin.put(`/courses/${staffedId}/staff`, {
      trainerIds: ['00000000-0000-4000-8000-000000000000'],
    });
    expect(unknown.status).toBe(400);
  });

  it('shows staff their course whole, drafts included', async () => {
    const listed = expectStatus(await trainer.get('/courses?pageSize=100'), 200)
      .body as Paginated<CourseSummary>;
    const mine = listed.data.find((c) => c.id === staffedId);
    expect(mine?.status, 'a draft, listed for its staff').toBe('draft');
    expect(mine?.staff.map((s) => s.trainerId)).toEqual([trainerId]);
    const detail = expectStatus(await trainer.get(`/courses/${staffedId}`), 200)
      .body as CourseDetail;
    expect(detail.canEdit).toBe(true);
    const lesson = detail.modules[0]!.lessons[0]!;
    expectStatus(await trainer.get(`/lessons/${lesson.id}`), 200);
    // A course their batch has but they are not in charge of: readable, not theirs to change.
    const other = expectStatus(await trainer.get(`/courses/${notStaffedId}`), 200)
      .body as CourseDetail;
    expect(other.canEdit).toBe(false);
  });

  it('lets staff change the content, and nobody else on the trainer side', async () => {
    expectStatus(await trainer.put(`/courses/${staffedId}/outline`, outline('Rewritten')), 200);
    expectStatus(
      await trainer.patch(`/courses/${staffedId}`, { description: 'Written by its trainer.' }),
      200,
    );
    expect((await trainer.put(`/courses/${notStaffedId}/outline`, outline('Taken'))).status).toBe(
      403,
    );
    expect(
      (await trainer.patch(`/courses/${notStaffedId}`, { description: 'Not mine' })).status,
    ).toBe(403);
    expect((await student.put(`/courses/${staffedId}/outline`, outline('Learner'))).status).toBe(
      403,
    );
    // Creating and archiving stay with the people who manage the catalogue.
    expect(
      (await trainer.post('/courses', { title: `Trainer course ${unique}`, level: 'beginner' }))
        .status,
    ).toBe(403);
    expect((await trainer.delete(`/courses/${staffedId}`)).status).toBe(403);
    const lessons = await prisma.lesson.findMany({ where: { module: { courseId: notStaffedId } } });
    expect(lessons.map((l) => l.title)).toEqual(['Welcome']);
  });

  it('lets staff publish to the batches they teach, and only there', async () => {
    for (const audience of [
      { scopeType: 'batch', scopeId: otherBatchId },
      { scopeType: 'program', scopeId: programId },
      { scopeType: 'all', scopeId: null },
    ]) {
      const refused = await trainer.post(`/courses/${staffedId}/publish`, audience);
      expect(refused.status, audience.scopeType).toBe(403);
    }
    const published = expectStatus(
      await trainer.post(`/courses/${staffedId}/publish`, { scopeType: 'batch', scopeId: batchId }),
      201,
    ).body as PublicationRecord;
    // Not staff: their batch has the course, but publishing it again is not theirs to do.
    const notStaff = await trainer.post(`/courses/${notStaffedId}/publish`, {
      scopeType: 'batch',
      scopeId: batchId,
    });
    expect(notStaff.status).toBe(403);
    const adminWide = expectStatus(
      await admin.post(`/courses/${staffedId}/publish`, {
        scopeType: 'program',
        scopeId: programId,
      }),
      201,
    ).body as PublicationRecord;
    expect(
      (await trainer.delete(`/courses/${staffedId}/publications/${adminWide.id}`)).status,
      'a programme publication is an administrator’s',
    ).toBe(403);
    expectStatus(await trainer.delete(`/courses/${staffedId}/publications/${published.id}`), 200);
    expectStatus(await admin.delete(`/courses/${staffedId}/publications/${adminWide.id}`), 200);
  });

  it('lets staff file a class recording into their course, wherever else it is shared', async () => {
    expectStatus(
      await admin.post(`/courses/${staffedId}/publish`, {
        scopeType: 'program',
        scopeId: programId,
      }),
      201,
    );
    const at = new Date(Date.now() - 3 * HOUR);
    const session = await prisma.liveSession.create({
      data: {
        batchId,
        subject: 'Core Java',
        title: `Staff recording ${unique}`,
        startsAt: at,
        endsAt: new Date(at.getTime() + HOUR),
        status: 'completed',
      },
    });
    expectStatus(
      await trainer.post(`/sessions/${session.id}/recording`, {
        url: 'https://recordings.example.test/staff',
        courseId: staffedId,
        moduleTitle: 'Basics',
      }),
      201,
    );
  });

  it('reaches institutes seeded before the change, once', async () => {
    const role = await prisma.role.findFirstOrThrow({
      where: { organizationId, key: SYSTEM_ROLES.TRAINER },
    });
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { key: 'courses:publish' },
    });
    const grant = { roleId_permissionId: { roleId: role.id, permissionId: permission.id } };
    const applied = () =>
      prisma.setting.findUniqueOrThrow({
        where: { organizationId_key: { organizationId, key: APPLIED_BUNDLE_CHANGES_KEY } },
      });
    const before = await applied();
    try {
      // An institute seeded before the change: the grant is missing and the change unapplied.
      await prisma.rolePermission.delete({ where: grant });
      await prisma.setting.update({
        where: { id: before.id },
        data: { value: { keys: [] } },
      });
      await syncSystemRoles(prisma, organizationId);
      expect((await prisma.rolePermission.findUnique({ where: grant }))?.scope).toBe('batch');
      // A client who then removes it keeps it removed.
      await prisma.rolePermission.delete({ where: grant });
      await syncSystemRoles(prisma, organizationId);
      expect(await prisma.rolePermission.findUnique({ where: grant })).toBeNull();
    } finally {
      await prisma.rolePermission.upsert({
        where: grant,
        create: { roleId: role.id, permissionId: permission.id, scope: 'batch' },
        update: {},
      });
    }
  });
});
