import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  SYSTEM_ROLES,
  type AttemptState,
  type BatchSummary,
  type CourseSummary,
  type EffectiveFlags,
  type MeResponse,
  type Paginated,
  type QuestionSummary,
  type StudentSummary,
  type TestSummary,
  type TrainerDashboard,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

const HOUR = 3_600_000;

/**
 * Phases 3 and 4, object-level scope for staff (SEC-02 to SEC-07). Holding a permission is not
 * enough: whose content it is, which batch and which learner decide as well, and no privilege is
 * handed out by someone who does not hold it. Every case is checked from the side that must be
 * refused as well as the side that may act.
 */
describe('staff scope', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: Session;
  let admin: Session;
  let trainer: Session;
  let student: Session;
  let outsider: Session;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);

  let organizationId = '';
  let batchId = '';
  let otherBatchId = '';
  let adminUserId = '';
  let outsiderStudentId = '';

  async function account(label: string, role: string) {
    const roleRow = await prisma.role.findFirstOrThrow({ where: { organizationId, key: role } });
    const email = `scope-${label}-${unique}@test.local`;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `Scope ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: roleRow.id }] },
      },
    });
    return { user, email };
  }

  async function signIn(email: string): Promise<Session> {
    const session = new Session(app);
    expectStatus(await session.login(email, password), 200);
    return session;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    organizationId = (await prisma.organization.findFirstOrThrow()).id;
    superAdmin = await signIn(TEST_ACCOUNTS.superAdmin.email);
    admin = await signIn(TEST_ACCOUNTS.admin.email);
    trainer = await signIn(TEST_ACCOUNTS.trainer.email);
    student = await signIn(TEST_ACCOUNTS.student.email);
    batchId = (
      await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.assignedBatchCode } })
    ).id;
    otherBatchId = (
      await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.otherBatchCode } })
    ).id;
    adminUserId = (
      await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.admin.email } })
    ).id;
    const learner = await account('outsider', SYSTEM_ROLES.STUDENT);
    const profile = await prisma.studentProfile.create({
      data: { userId: learner.user.id, studentCode: `STU-SC-${unique}`, status: 'active' },
    });
    outsiderStudentId = profile.id;
    await prisma.batchMember.create({ data: { batchId: otherBatchId, studentId: profile.id } });
    outsider = await signIn(learner.email);
  });

  afterAll(async () => {
    await app.close();
  });

  // ───────────────────────── SEC-02: tests and questions ─────────────────────────

  describe('a test belongs to its author', () => {
    let adminQuestionId = '';
    let adminTestId = '';
    let ownTestId = '';
    let ownQuestionId = '';

    async function objectiveQuestion(session: Session, title: string): Promise<string> {
      const question = expectStatus(
        await session.post('/questions', {
          title,
          body: 'Pick the true statement.',
          type: 'true_false',
          options: [
            { body: 'True', isCorrect: true },
            { body: 'False', isCorrect: false },
          ],
        }),
        201,
      ).body as QuestionSummary;
      expectStatus(
        await session.post(`/questions/${question.id}/status`, { status: 'published' }),
        201,
      );
      return question.id;
    }

    beforeAll(async () => {
      adminQuestionId = await objectiveQuestion(superAdmin, `Admin's question ${unique}`);
      ownQuestionId = await objectiveQuestion(trainer, `Trainer's question ${unique}`);
      adminTestId = (
        expectStatus(
          await superAdmin.post('/tests', { title: `Admin test ${unique}`, kind: 'weekly' }),
          201,
        ).body as TestSummary
      ).id;
      expectStatus(
        await superAdmin.put(`/tests/${adminTestId}/paper`, {
          sections: [
            { title: 'One', instructions: '', questions: [{ questionId: adminQuestionId }] },
          ],
        }),
        200,
      );
      expectStatus(
        await superAdmin.post(`/tests/${adminTestId}/status`, { status: 'published' }),
        201,
      );
      expectStatus(
        await superAdmin.post(`/tests/${adminTestId}/schedules`, {
          batchId,
          opensAt: new Date(Date.now() - 60_000).toISOString(),
          closesAt: new Date(Date.now() + 2 * HOUR).toISOString(),
        }),
        201,
      );
    });

    it('lets a trainer use another author’s test in their batch, never change it', async () => {
      expectStatus(await trainer.get(`/tests/${adminTestId}`), 200);
      expect((await trainer.patch(`/tests/${adminTestId}`, { title: 'Renamed' })).status).toBe(403);
      expect(
        (
          await trainer.patch(`/tests/${adminTestId}`, {
            settings: {
              durationMinutes: 30,
              maxAttempts: 1,
              shuffleQuestions: false,
              shuffleOptions: false,
              resultPolicy: 'immediately',
              reviewPolicy: 'full',
              trackTabSwitches: true,
              requireFullScreen: false,
              showRank: true,
            },
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await trainer.put(`/tests/${adminTestId}/paper`, {
            sections: [{ title: 'Mine now', instructions: '', questions: [] }],
          })
        ).status,
      ).toBe(403);
      expect(
        (await trainer.post(`/tests/${adminTestId}/status`, { status: 'archived' })).status,
      ).toBe(403);
      const stored = await prisma.test.findUniqueOrThrow({ where: { id: adminTestId } });
      expect(stored.title).toBe(`Admin test ${unique}`);
      expect(stored.status).toBe('published');
    });

    it('puts only the trainer’s own questions on the trainer’s papers', async () => {
      ownTestId = (
        expectStatus(
          await trainer.post('/tests', { title: `Trainer test ${unique}`, kind: 'weekly' }),
          201,
        ).body as TestSummary
      ).id;
      const borrowed = await trainer.put(`/tests/${ownTestId}/paper`, {
        sections: [
          { title: 'One', instructions: '', questions: [{ questionId: adminQuestionId }] },
        ],
      });
      expect(borrowed.status).toBe(400);
      expect(JSON.stringify(borrowed.body)).toContain('not yours to use');
      expectStatus(
        await trainer.put(`/tests/${ownTestId}/paper`, {
          sections: [
            { title: 'One', instructions: '', questions: [{ questionId: ownQuestionId }] },
          ],
        }),
        200,
      );
      expectStatus(
        await trainer.patch(`/tests/${ownTestId}`, { title: `Trainer test ${unique} v2` }),
        200,
      );
    });

    it('fixes a paper once anyone has sat the test', async () => {
      expectStatus(await trainer.post(`/tests/${ownTestId}/status`, { status: 'published' }), 201);
      expectStatus(
        await trainer.post(`/tests/${ownTestId}/schedules`, {
          batchId,
          opensAt: new Date(Date.now() - 60_000).toISOString(),
          closesAt: new Date(Date.now() + HOUR).toISOString(),
        }),
        201,
      );
      const state = expectStatus(await student.post(`/tests/${ownTestId}/attempts`), 201)
        .body as AttemptState;
      expectStatus(await student.post(`/attempts/${state.attemptId}/submit`, {}), 201);
      const answers = () => prisma.testAnswer.count({ where: { attemptId: state.attemptId } });
      const before = await answers();
      const changed = await trainer.put(`/tests/${ownTestId}/paper`, {
        sections: [{ title: 'Replaced', instructions: '', questions: [] }],
      });
      expect(changed.status).toBe(422);
      expect(problemCode(changed)).toBe('test_paper_fixed');
      expect(await answers(), 'what the learner submitted is kept').toBe(before);
      expect(await prisma.testQuestion.count({ where: { section: { testId: ownTestId } } })).toBe(
        1,
      );
    });
  });

  // ───────────────────────── SEC-03: roles ─────────────────────────

  describe('roles are handed out only by those who hold them', () => {
    let opsRoleId = '';

    beforeAll(async () => {
      opsRoleId = (
        expectStatus(
          await superAdmin.post('/roles', { key: `ops_${unique}`, name: `Operations ${unique}` }),
          201,
        ).body as { id: string }
      ).id;
      expectStatus(
        await superAdmin.put(`/roles/${opsRoleId}/permissions`, [
          { permissionKey: 'settings:manage', scope: 'all' },
          { permissionKey: 'users:read', scope: 'all' },
        ]),
        200,
      );
    });

    it('refuses an administrator a role carrying powers they do not hold', async () => {
      const invited = await admin.post('/users', {
        name: 'Would Be Operator',
        email: `ops-${unique}@test.local`,
        roleKeys: [`ops_${unique}`],
      });
      expect(invited.status).toBe(403);
      expect(JSON.stringify(invited.body)).toContain('settings:manage');
      expect(await prisma.user.count({ where: { email: `ops-${unique}@test.local` } })).toBe(0);
    });

    it('refuses anyone but a Super Admin a change to their own roles', async () => {
      const self = await admin.put(`/users/${adminUserId}/roles`, {
        roleKeys: [SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.TRAINER],
      });
      expect(self.status).toBe(403);
    });

    it('lets an administrator grant what they hold, and not manage who holds more', async () => {
      const created = expectStatus(
        await admin.post('/users', {
          name: 'New Trainer',
          email: `new-trainer-${unique}@test.local`,
          roleKeys: [SYSTEM_ROLES.TRAINER],
        }),
        201,
      ).body as { id: string };
      // The Super Admin then gives that person the operations role.
      expectStatus(
        await superAdmin.put(`/users/${created.id}/roles`, {
          roleKeys: [SYSTEM_ROLES.TRAINER, `ops_${unique}`],
        }),
        200,
      );
      expect((await admin.post(`/users/${created.id}/deactivate`, { reason: 'Test' })).status).toBe(
        403,
      );
      expect(
        (await admin.put(`/users/${created.id}/roles`, { roleKeys: [SYSTEM_ROLES.TRAINER] }))
          .status,
      ).toBe(403);
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: created.id } });
      expect(stored.status).not.toBe('deactivated');
    });

    it('keeps a role bundle to the scopes the catalogue allows', async () => {
      const hidden = await superAdmin.put(`/roles/${opsRoleId}/permissions`, [
        { permissionKey: 'roles:manage', scope: 'own' },
      ]);
      expect(hidden.status).toBe(400);
      expect(JSON.stringify(hidden.body)).toContain('roles:manage');
    });

    it('never copies the Super Admin role', async () => {
      const superRole = await prisma.role.findFirstOrThrow({
        where: { organizationId, key: SYSTEM_ROLES.SUPER_ADMIN },
      });
      const copy = await superAdmin.post('/roles', {
        key: `copy_${unique}`,
        name: 'Copy',
        cloneFromRoleId: superRole.id,
      });
      expect(copy.status).toBe(422);
      expect(problemCode(copy)).toBe('role_locked');
    });
  });

  // ───────────────────────── SEC-05: a trainer's reach ─────────────────────────

  describe('a trainer’s reach', () => {
    it('never lists learners outside the trainer’s batches, unassigned ones included', async () => {
      const loner = await account('loner', SYSTEM_ROLES.STUDENT);
      await prisma.studentProfile.create({
        data: { userId: loner.user.id, studentCode: `STU-LN-${unique}`, status: 'active' },
      });
      const asTrainer = expectStatus(
        await trainer.get('/students?unassigned=true&pageSize=100'),
        200,
      ).body as Paginated<StudentSummary>;
      expect(asTrainer.data).toEqual([]);
      const asAdmin = expectStatus(await admin.get('/students?unassigned=true&pageSize=100'), 200)
        .body as Paginated<StudentSummary>;
      expect(asAdmin.data.map((s) => s.studentCode)).toContain(`STU-LN-${unique}`);
      // "false" means false.
      const assigned = expectStatus(await admin.get('/students?unassigned=false&pageSize=100'), 200)
        .body as Paginated<StudentSummary>;
      expect(assigned.data.map((s) => s.studentCode)).toContain(`STU-SC-${unique}`);
    });

    it('shows a trainer only the announcements meant for them', async () => {
      const make = async (title: string, batchIds: string[]) =>
        (
          expectStatus(
            await superAdmin.post('/announcements', {
              title,
              body: 'For the batch.',
              audience: { roleKeys: [], batchIds, programIds: [] },
              startsAt: new Date(Date.now() - 60_000).toISOString(),
              endsAt: null,
              channels: ['in_app'],
            }),
            201,
          ).body as { id: string }
        ).id;
      await make(`For the other batch ${unique}`, [otherBatchId]);
      const mine = await make(`For my batch ${unique}`, [batchId]);
      const removed = await make(`Withdrawn ${unique}`, [batchId]);
      expectStatus(await superAdmin.delete(`/announcements/${removed}`), 204);
      const dashboard = expectStatus(await trainer.get('/trainer/dashboard'), 200)
        .body as TrainerDashboard;
      const titles = dashboard.announcements.map((a) => a.title);
      expect(titles).not.toContain(`For the other batch ${unique}`);
      expect(titles).not.toContain(`Withdrawn ${unique}`);
      expect(dashboard.announcements.map((a) => a.id)).toContain(mine);
    });
  });

  // ───────────────────────── SEC-04: one way into a batch ─────────────────────────

  describe('one way into a batch', () => {
    let programId = '';
    let smallBatch: BatchSummary;

    beforeAll(async () => {
      programId = (await prisma.batch.findUniqueOrThrow({ where: { id: batchId } })).programId;
      smallBatch = expectStatus(
        await superAdmin.post('/batches', {
          programId,
          code: `SC-${unique}-S1`,
          name: 'Small batch',
          mode: 'online',
          startDate: '2026-02-02',
          endDate: '2026-12-30',
          capacity: 1,
        }),
        201,
      ).body as BatchSummary;
    });

    it('leaves a transferred learner where they were when the new batch is full', async () => {
      const filler = await account('filler', SYSTEM_ROLES.STUDENT);
      const fillerProfile = await prisma.studentProfile.create({
        data: { userId: filler.user.id, studentCode: `STU-FL-${unique}`, status: 'active' },
      });
      expectStatus(
        await superAdmin.post(`/batches/${smallBatch.id}/members`, {
          studentIds: [fillerProfile.id],
        }),
        201,
      );
      const moved = await superAdmin.post(`/batches/${otherBatchId}/members/transfer`, {
        studentId: outsiderStudentId,
        toBatchId: smallBatch.id,
        reason: 'Trying a full batch',
      });
      expect(moved.status).toBe(422);
      expect(problemCode(moved)).toBe('capacity_exceeded');
      const stillThere = await prisma.batchMember.findFirst({
        where: { batchId: otherBatchId, studentId: outsiderStudentId, isActive: true },
      });
      expect(stillThere, 'the learner is still in their batch').not.toBeNull();
    });

    it('refuses a closed batch', async () => {
      const closed = expectStatus(
        await superAdmin.post('/batches', {
          programId,
          code: `SC-${unique}-C1`,
          name: 'Closed batch',
          mode: 'online',
          startDate: '2026-01-05',
          endDate: '2026-03-30',
          capacity: 10,
        }),
        201,
      ).body as BatchSummary;
      await prisma.batch.update({ where: { id: closed.id }, data: { status: 'completed' } });
      const added = await superAdmin.post(`/batches/${closed.id}/members`, {
        studentIds: [outsiderStudentId],
      });
      expect(added.status).toBe(422);
      expect(problemCode(added)).toBe('batch_closed');
    });

    it('enrols a learner created with a batch in that batch’s courses', async () => {
      const course = expectStatus(
        await superAdmin.post('/courses', { title: `Scope course ${unique}`, level: 'beginner' }),
        201,
      ).body as CourseSummary;
      expectStatus(
        await superAdmin.put(`/courses/${course.id}/outline`, {
          modules: [
            {
              title: 'One',
              unlockRule: { type: 'always' },
              lessons: [{ title: 'Read', type: 'article', content: { html: '<p>Read</p>' } }],
            },
          ],
        }),
        200,
      );
      expectStatus(
        await superAdmin.post(`/courses/${course.id}/publish`, {
          scopeType: 'batch',
          scopeId: otherBatchId,
        }),
        201,
      );
      const created = expectStatus(
        await superAdmin.post('/students', {
          name: 'Joined With A Batch',
          email: `joined-${unique}@test.local`,
          batchId: otherBatchId,
          sendInvitation: false,
        }),
        201,
      ).body as StudentSummary;
      let enrolled = 0;
      for (let tries = 0; tries < 50 && enrolled === 0; tries += 1) {
        enrolled = await prisma.enrollment.count({
          where: { studentId: created.id, courseId: course.id },
        });
        if (enrolled === 0) await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(enrolled, 'the batch’s course reaches the new learner').toBe(1);
    });
  });

  // ───────────────────────── SEC-07: flag audiences ─────────────────────────

  describe('a module rolled out to some batches first', () => {
    afterAll(async () => {
      await superAdmin.patch('/flags/module.doubts', { audience: { roleKeys: [], batchIds: [] } });
    });

    it('opens it to those batches only, on the server as well as in the menus', async () => {
      expectStatus(
        await superAdmin.patch('/flags/module.doubts', {
          audience: { roleKeys: [], batchIds: [otherBatchId] },
        }),
        200,
      );
      const refused = await student.get('/me/doubts');
      expect(refused.status).toBe(403);
      expect(problemCode(refused)).toBe('module_disabled');
      expectStatus(await outsider.get('/me/doubts'), 200);
      // Staff who work across the institute are not limited by a batch audience.
      expectStatus(await admin.get('/doubts'), 200);
      const flags = (expectStatus(await student.get('/me'), 200).body as MeResponse)
        .flags as EffectiveFlags;
      expect(flags['module.doubts']).toBe(false);
    });

    it('refuses an audience naming a batch or role that does not exist', async () => {
      const bad = await superAdmin.patch('/flags/module.doubts', {
        audience: {
          roleKeys: ['no_such_role'],
          batchIds: ['00000000-0000-4000-8000-000000000000'],
        },
      });
      expect(bad.status).toBe(400);
      expect(problemCode(bad)).toBe('validation_failed');
    });
  });
});
