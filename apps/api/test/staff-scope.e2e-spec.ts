import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  SYSTEM_ROLES,
  type AttemptState,
  type BatchSummary,
  type CourseSummary,
  type DoubtSummary,
  type EffectiveFlags,
  type ExportJobRecord,
  type MeResponse,
  type Paginated,
  type ProgressOverview,
  type QuestionDetail,
  type QuestionSummary,
  type ReportData,
  type ReviewQueueItem,
  type StudentAttendanceView,
  type StudentSummary,
  type TestSummary,
  type TrainerDashboard,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../src/core/storage/storage.driver.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

const HOUR = 3_600_000;
const PDF = new TextEncoder().encode('%PDF-1.7\n% test file\n');

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

  // ───────────────────────── SEC-05: teaching is not learning ─────────────────────────

  describe('a trainer whose role was taken away', () => {
    it('keeps no trainer’s view of the batches they taught', async () => {
      // The assignment and the profile stay on record; the role, and with it the view, is gone.
      const person = await account('demoted', SYSTEM_ROLES.STUDENT);
      const profile = await prisma.trainerProfile.create({ data: { userId: person.user.id } });
      await prisma.batchTrainer.create({
        data: { batchId, trainerId: profile.id, subject: 'core-java' },
      });
      const startsAt = new Date(Date.now() + 2 * HOUR);
      const session = await prisma.liveSession.create({
        data: {
          batchId,
          trainerId: profile.id,
          subject: 'Core Java',
          title: `Taught before ${unique}`,
          startsAt,
          endsAt: new Date(startsAt.getTime() + HOUR),
        },
      });
      try {
        const demoted = await signIn(person.email);
        expect((await demoted.get('/trainer/dashboard')).status).toBe(403);
        const day = (offset: number) =>
          new Date(Date.now() + offset * 24 * HOUR).toISOString().slice(0, 10);
        const schedule = expectStatus(
          await demoted.get(`/me/schedule?from=${day(-1)}&to=${day(2)}`),
          200,
        );
        expect(JSON.stringify(schedule.body)).not.toContain(`Taught before ${unique}`);
        const board = expectStatus(await demoted.get('/leaderboard'), 200).body as {
          batches: { id: string }[];
        };
        expect(board.batches.map((b) => b.id)).not.toContain(batchId);
      } finally {
        await prisma.liveSession.delete({ where: { id: session.id } });
        await prisma.batchTrainer.deleteMany({ where: { trainerId: profile.id } });
      }
    });
  });

  describe('a trainer who is also a learner', () => {
    let dual: Session;
    let dualStudentId = '';

    afterAll(async () => {
      await prisma.batchMember.updateMany({
        where: { studentId: dualStudentId },
        data: { isActive: false, leftAt: new Date() },
      });
    });

    beforeAll(async () => {
      const person = await account('dual', SYSTEM_ROLES.STUDENT);
      const trainerRole = await prisma.role.findFirstOrThrow({
        where: { organizationId, key: SYSTEM_ROLES.TRAINER },
      });
      await prisma.userRole.create({ data: { userId: person.user.id, roleId: trainerRole.id } });
      await prisma.trainerProfile.create({ data: { userId: person.user.id } });
      const profile = await prisma.studentProfile.create({
        data: { userId: person.user.id, studentCode: `STU-DUAL-${unique}`, status: 'active' },
      });
      dualStudentId = profile.id;
      // A learner in the other batch, teaching none yet.
      await prisma.batchMember.create({ data: { batchId: otherBatchId, studentId: profile.id } });
      dual = await signIn(person.email);
    });

    it('reaches as staff only the batches they teach, not the one they learn in', async () => {
      const students = expectStatus(await dual.get('/students?pageSize=100'), 200)
        .body as Paginated<StudentSummary>;
      expect(students.data.map((s) => s.id)).not.toContain(outsiderStudentId);
      expect((await dual.get(`/attendance/students/${outsiderStudentId}`)).status).toBe(403);
      expect((await dual.get(`/students/${outsiderStudentId}/progress`)).status).toBe(403);
      // Their own learning is untouched.
      expectStatus(await dual.get('/me/attendance'), 200);
    });
  });

  // ───────────────────────── SEC-05 / D6: one learner, two batches ─────────────────────────

  describe('a trainer sees a learner within their own batches', () => {
    let bothId = '';
    let bothCode = '';
    let ownCourse = { courseId: '', lessonId: '' };
    let otherCourse = { courseId: '', lessonId: '' };
    let ownSessionId = '';
    let otherSessionId = '';
    let otherDoubtId = '';
    let ownSubmissionId = '';
    let otherSubmissionId = '';
    const assignmentIds: string[] = [];

    afterAll(async () => {
      await prisma.submission.deleteMany({ where: { studentId: bothId } });
      await prisma.assignment.deleteMany({ where: { id: { in: assignmentIds } } });
      await prisma.doubt.deleteMany({ where: { studentId: bothId } });
      await prisma.liveSession.deleteMany({
        where: { id: { in: [ownSessionId, otherSessionId] } },
      });
      for (const course of [ownCourse, otherCourse]) {
        expectStatus(await superAdmin.delete(`/courses/${course.courseId}`), 200);
      }
      await prisma.batchMember.updateMany({
        where: { studentId: bothId },
        data: { isActive: false, leftAt: new Date() },
      });
    });

    async function courseFor(title: string, scopeId: string) {
      const course = expectStatus(
        await superAdmin.post('/courses', { title, level: 'beginner', subject: 'core-java' }),
        201,
      ).body as CourseSummary;
      expectStatus(
        await superAdmin.put(`/courses/${course.id}/outline`, {
          modules: [
            {
              title: 'Basics',
              unlockRule: { type: 'always' },
              lessons: [
                { title: `${title} lesson`, type: 'article', content: { html: '<p>Hi</p>' } },
              ],
            },
          ],
        }),
        200,
      );
      expectStatus(
        await superAdmin.post(`/courses/${course.id}/publish`, { scopeType: 'batch', scopeId }),
        201,
      );
      const lesson = await prisma.lesson.findFirstOrThrow({
        where: { module: { courseId: course.id } },
      });
      return { courseId: course.id, lessonId: lesson.id };
    }

    /** Work handed in for an assignment given to one batch. */
    async function handedIn(title: string, toBatch: string, questionId: string) {
      const assignment = await prisma.assignment.create({
        data: {
          organizationId,
          title,
          status: 'published',
          createdById: adminUserId,
          modules: {
            create: [
              { title: 'One', position: 0, questions: { create: [{ questionId, position: 0 }] } },
            ],
          },
        },
        include: { modules: { include: { questions: true } } },
      });
      assignmentIds.push(assignment.id);
      await prisma.assignmentPublication.create({
        data: { assignmentId: assignment.id, batchId: toBatch },
      });
      const placement = assignment.modules[0]!.questions[0]!;
      const submission = await prisma.submission.create({
        data: {
          assignmentId: assignment.id,
          assignmentQuestionId: placement.id,
          questionId,
          studentId: bothId,
          status: 'awaiting_grading',
          text: 'My answer',
        },
      });
      return submission.id;
    }

    beforeAll(async () => {
      const learner = await account('both', SYSTEM_ROLES.STUDENT);
      bothCode = `STU-BOTH-${unique}`;
      bothId = (
        await prisma.studentProfile.create({
          data: { userId: learner.user.id, studentCode: bothCode, status: 'active' },
        })
      ).id;
      await prisma.batchMember.createMany({
        data: [
          { batchId, studentId: bothId },
          { batchId: otherBatchId, studentId: bothId },
        ],
      });
      ownCourse = await courseFor(`Own batch course ${unique}`, batchId);
      otherCourse = await courseFor(`Other batch course ${unique}`, otherBatchId);
      for (const lessonId of [ownCourse.lessonId, otherCourse.lessonId]) {
        await prisma.lessonProgress.create({
          data: { studentId: bothId, lessonId, status: 'completed', completedAt: new Date() },
        });
      }
      await prisma.activityEvent.createMany({
        data: [
          {
            userId: learner.user.id,
            type: 'lesson.completed',
            entityType: 'lesson',
            entityId: ownCourse.lessonId,
            title: `Own batch lesson ${unique}`,
          },
          {
            userId: learner.user.id,
            type: 'lesson.completed',
            entityType: 'lesson',
            entityId: otherCourse.lessonId,
            title: `Other batch lesson ${unique}`,
          },
        ],
      });
      const at = new Date(Date.now() - 2 * 86_400_000);
      for (const [batch, label] of [
        [batchId, 'own'],
        [otherBatchId, 'other'],
      ] as const) {
        const session = await prisma.liveSession.create({
          data: {
            batchId: batch,
            subject: 'Core Java',
            title: `D6 ${label} class ${unique}`,
            startsAt: at,
            endsAt: new Date(at.getTime() + HOUR),
            status: 'completed',
          },
        });
        await prisma.attendanceRecord.create({
          data: { sessionId: session.id, studentId: bothId, batchId: batch, status: 'present' },
        });
        if (label === 'own') ownSessionId = session.id;
        else otherSessionId = session.id;
      }
      const doubt = (title: string, courseId: string | null) =>
        prisma.doubt.create({
          data: { organizationId, studentId: bothId, courseId, title, body: 'Why does it work?' },
        });
      await doubt(`Own course doubt ${unique}`, ownCourse.courseId);
      otherDoubtId = (await doubt(`Other course doubt ${unique}`, otherCourse.courseId)).id;
      await doubt(`General doubt ${unique}`, null);

      const question = expectStatus(
        await superAdmin.post('/questions', {
          title: `Explain it ${unique}`,
          body: 'Explain the idea.',
          type: 'descriptive',
          rubric: 'Clear and correct.',
        }),
        201,
      ).body as QuestionSummary;
      expectStatus(
        await superAdmin.post(`/questions/${question.id}/status`, { status: 'published' }),
        201,
      );
      ownSubmissionId = await handedIn(`Own batch work ${unique}`, batchId, question.id);
      otherSubmissionId = await handedIn(`Other batch work ${unique}`, otherBatchId, question.id);
    });

    it('shows attendance from the trainer’s batches only', async () => {
      const sessionsIn = (view: StudentAttendanceView) =>
        view.days.flatMap((day) => day.entries.map((entry) => entry.sessionId));
      const seen = sessionsIn(
        expectStatus(await trainer.get(`/attendance/students/${bothId}`), 200)
          .body as StudentAttendanceView,
      );
      expect(seen).toContain(ownSessionId);
      expect(seen).not.toContain(otherSessionId);
      const whole = sessionsIn(
        expectStatus(await admin.get(`/attendance/students/${bothId}`), 200)
          .body as StudentAttendanceView,
      );
      expect(whole).toEqual(expect.arrayContaining([ownSessionId, otherSessionId]));
    });

    it('shows progress and activity from the trainer’s batches only', async () => {
      const mine = expectStatus(await trainer.get(`/students/${bothId}/progress`), 200)
        .body as ProgressOverview;
      expect(mine.courses.map((c) => c.courseId)).toContain(ownCourse.courseId);
      expect(mine.courses.map((c) => c.courseId)).not.toContain(otherCourse.courseId);
      const titles = mine.activity.map((a) => a.title);
      expect(titles).toContain(`Own batch lesson ${unique}`);
      expect(titles).not.toContain(`Other batch lesson ${unique}`);

      const whole = expectStatus(await admin.get(`/students/${bothId}/progress`), 200)
        .body as ProgressOverview;
      expect(whole.courses.map((c) => c.courseId)).toEqual(
        expect.arrayContaining([ownCourse.courseId, otherCourse.courseId]),
      );
    });

    it('shows the doubts about the trainer’s courses, and those about no course', async () => {
      const listed = expectStatus(await trainer.get(`/doubts?q=${unique}&pageSize=100`), 200)
        .body as Paginated<DoubtSummary>;
      const titles = listed.data.map((d) => d.title);
      expect(titles).toEqual(
        expect.arrayContaining([`Own course doubt ${unique}`, `General doubt ${unique}`]),
      );
      expect(titles).not.toContain(`Other course doubt ${unique}`);
      expect((await trainer.get(`/doubts/${otherDoubtId}`)).status).toBe(404);
      expectStatus(await admin.get(`/doubts/${otherDoubtId}`), 200);
    });

    it('reports the learner’s courses of the trainer’s batches only', async () => {
      const report = expectStatus(
        await trainer.get(`/reports/progress?q=${bothCode}&pageSize=100`),
        200,
      ).body as ReportData;
      const courses = report.rows.filter((r) => r.studentCode === bothCode).map((r) => r.course);
      expect(courses).toContain(`Own batch course ${unique}`);
      expect(courses).not.toContain(`Other batch course ${unique}`);
      // The dashboard counts the same courses as the report (Phase 5): not the other batch's.
      const dashboard = expectStatus(await trainer.get('/reports/dashboard'), 200).body as {
        courses: { id: string }[];
      };
      const shown = dashboard.courses.map((c) => c.id);
      expect(shown).toContain(ownCourse.courseId);
      expect(shown).not.toContain(otherCourse.courseId);
    });

    it('lists for review only the answers the trainer may open', async () => {
      const queue = expectStatus(
        await trainer.get(`/submissions?state=pending&q=${bothCode}&pageSize=100`),
        200,
      ).body as Paginated<ReviewQueueItem>;
      const ids = queue.data.map((item) => item.submissionId);
      expect(ids).toContain(ownSubmissionId);
      expect(ids).not.toContain(otherSubmissionId);
      expect((await trainer.get(`/submissions/${otherSubmissionId}`)).status).toBe(403);
    });

    it('lists the learner’s certificates of courses the trainer’s batches have', async () => {
      const certificates = await Promise.all(
        [ownCourse.courseId, otherCourse.courseId].map((courseId, index) =>
          prisma.certificate.create({
            data: {
              organizationId,
              studentId: bothId,
              courseId,
              code: `D${unique}CERT${index}`,
              learnerName: 'Both batches',
              courseTitle: index === 0 ? 'Own batch course' : 'Other batch course',
              institute: 'SI Academy',
              completedAt: new Date(),
            },
          }),
        ),
      );
      try {
        const listed = expectStatus(
          await trainer.get(`/certificates?q=${bothCode}&pageSize=100`),
          200,
        ).body as Paginated<{ id: string }>;
        expect(listed.data.map((c) => c.id)).toEqual([certificates[0]!.id]);
      } finally {
        await prisma.certificate.deleteMany({
          where: { id: { in: certificates.map((c) => c.id) } },
        });
      }
    });

    it('names a learner given a course on their own to its staff only within their batches', async () => {
      const trainerId = (
        await prisma.trainerProfile.findFirstOrThrow({
          where: { user: { email: TEST_ACCOUNTS.trainer.email } },
        })
      ).id;
      expectStatus(
        await superAdmin.put(`/courses/${ownCourse.courseId}/staff`, { trainerIds: [trainerId] }),
        200,
      );
      const given = [];
      for (const scopeId of [bothId, outsiderStudentId]) {
        given.push(
          (
            expectStatus(
              await superAdmin.post(`/courses/${ownCourse.courseId}/publish`, {
                scopeType: 'learner',
                scopeId,
              }),
              201,
            ).body as { id: string }
          ).id,
        );
      }
      try {
        const seen = expectStatus(
          await trainer.get(`/courses/${ownCourse.courseId}/publications`),
          200,
        ).body as { scopeType: string; scopeId: string | null; scopeLabel: string }[];
        const learners = seen.filter((p) => p.scopeType === 'learner');
        expect(learners.map((p) => p.scopeId).sort()).toEqual([bothId, null].sort());
        expect(learners.map((p) => p.scopeLabel)).toContain('A learner, on their own');
        expect(JSON.stringify(seen)).not.toContain('STU-SC-');
        const forAdmin = expectStatus(
          await superAdmin.get(`/courses/${ownCourse.courseId}/publications`),
          200,
        ).body as { scopeId: string | null }[];
        expect(forAdmin.map((p) => p.scopeId)).toContain(outsiderStudentId);
      } finally {
        for (const publicationId of given) {
          await superAdmin.delete(`/courses/${ownCourse.courseId}/publications/${publicationId}`);
        }
      }
    });
  });

  // ───────────────────────── SEC-05: recordings ─────────────────────────

  describe('a class recording', () => {
    let sessionId = '';
    let sharedCourseId = '';
    let ownCourseId = '';

    afterAll(async () => {
      for (const id of [sharedCourseId, ownCourseId]) {
        expectStatus(await superAdmin.delete(`/courses/${id}`), 200);
      }
      await prisma.liveSession.deleteMany({ where: { title: { endsWith: unique } } });
    });

    async function course(title: string, publications: { scopeType: string; scopeId: string }[]) {
      const created = expectStatus(
        await superAdmin.post('/courses', { title, level: 'beginner', subject: 'core-java' }),
        201,
      ).body as CourseSummary;
      expectStatus(
        await superAdmin.put(`/courses/${created.id}/outline`, {
          modules: [
            {
              title: 'Classes',
              unlockRule: { type: 'always' },
              lessons: [{ title: 'Welcome', type: 'article', content: { html: '<p>Hi</p>' } }],
            },
          ],
        }),
        200,
      );
      for (const publication of publications) {
        expectStatus(await superAdmin.post(`/courses/${created.id}/publish`, publication), 201);
      }
      return created.id;
    }

    beforeAll(async () => {
      const at = new Date(Date.now() - 3 * HOUR);
      sessionId = (
        await prisma.liveSession.create({
          data: {
            batchId,
            subject: 'Core Java',
            title: `Recorded ${unique}`,
            startsAt: at,
            endsAt: new Date(at.getTime() + HOUR),
            status: 'completed',
          },
        })
      ).id;
      const batch = await prisma.batch.findUniqueOrThrow({ where: { id: batchId } });
      sharedCourseId = await course(`Shared course ${unique}`, [
        { scopeType: 'batch', scopeId: batchId },
        { scopeType: 'program', scopeId: batch.programId },
      ]);
      ownCourseId = await course(`Own course ${unique}`, [
        { scopeType: 'batch', scopeId: batchId },
      ]);
    });

    it('goes only under a course given to the trainer’s batches and no others', async () => {
      const shared = await trainer.post(`/sessions/${sessionId}/recording`, {
        url: 'https://recordings.example.test/shared',
        courseId: sharedCourseId,
      });
      expect(shared.status).toBe(403);
      expect(JSON.stringify(shared.body)).toContain('shared beyond your batches');
    });

    it('never goes into a module the course’s author wrote', async () => {
      const authored = await trainer.post(`/sessions/${sessionId}/recording`, {
        url: 'https://recordings.example.test/authored',
        courseId: ownCourseId,
        moduleTitle: 'Classes',
      });
      expect(authored.status).toBe(400);
      expectStatus(
        await trainer.post(`/sessions/${sessionId}/recording`, {
          url: 'https://recordings.example.test/own',
          courseId: ownCourseId,
          moduleTitle: 'Recordings',
        }),
        201,
      );
    });

    it('says nothing about another batch’s class, not even that it has a recording', async () => {
      const lesson = await prisma.lesson.findFirstOrThrow({
        where: { module: { courseId: ownCourseId, title: 'Classes' } },
      });
      const at = new Date(Date.now() - 5 * HOUR);
      const theirs = await prisma.liveSession.create({
        data: {
          batchId: otherBatchId,
          subject: 'Core Java',
          title: `Their class ${unique}`,
          startsAt: at,
          endsAt: new Date(at.getTime() + HOUR),
          status: 'completed',
          recordingLessonId: lesson.id,
        },
      });
      const response = await trainer.post(`/sessions/${theirs.id}/recording`, {
        url: 'https://recordings.example.test/theirs',
        courseId: ownCourseId,
      });
      expect(response.status).toBe(403);
    });
  });

  // ───────────────────────── SEC-02 / D3: what has been answered is fixed ─────────────────

  describe('a question once answered', () => {
    let questionId = '';
    let testId = '';
    let attemptId = '';

    afterAll(async () => {
      expectStatus(await trainer.post(`/tests/${testId}/status`, { status: 'archived' }), 201);
    });

    beforeAll(async () => {
      questionId = (
        expectStatus(
          await trainer.post('/questions', {
            title: `Fixed key ${unique}`,
            body: 'Is this fixed?',
            type: 'true_false',
            options: [
              { body: 'True', isCorrect: true },
              { body: 'False', isCorrect: false },
            ],
          }),
          201,
        ).body as QuestionSummary
      ).id;
      expectStatus(
        await trainer.post(`/questions/${questionId}/status`, { status: 'published' }),
        201,
      );
      testId = (
        expectStatus(
          await trainer.post('/tests', { title: `Answered ${unique}`, kind: 'weekly' }),
          201,
        ).body as TestSummary
      ).id;
      expectStatus(
        await trainer.put(`/tests/${testId}/paper`, {
          sections: [{ title: 'One', instructions: '', questions: [{ questionId }] }],
        }),
        200,
      );
      expectStatus(await trainer.post(`/tests/${testId}/status`, { status: 'published' }), 201);
      expectStatus(
        await trainer.post(`/tests/${testId}/schedules`, {
          batchId,
          opensAt: new Date(Date.now() - 60_000).toISOString(),
          closesAt: new Date(Date.now() + HOUR).toISOString(),
        }),
        201,
      );
      attemptId = (
        expectStatus(await student.post(`/tests/${testId}/attempts`), 201).body as AttemptState
      ).attemptId;
    });

    it('keeps its key, and lets its wording be improved', async () => {
      const detail = expectStatus(await trainer.get(`/questions/${questionId}`), 200)
        .body as QuestionDetail;
      const body = (flip: boolean, title: string) => ({
        title,
        body: 'Is this fixed?',
        type: 'true_false',
        options: detail.options.map((o) => ({
          id: o.id,
          body: o.body,
          isCorrect: flip ? !o.isCorrect : o.isCorrect,
        })),
      });
      const flipped = await trainer.put(
        `/questions/${questionId}`,
        body(true, `Fixed key ${unique}`),
      );
      expect(flipped.status).toBe(422);
      expect(problemCode(flipped)).toBe('question_answered');
      expectStatus(
        await trainer.put(`/questions/${questionId}`, body(false, `Reworded ${unique}`)),
        200,
      );
      const options = await prisma.questionOption.findMany({ where: { questionId } });
      expect(options.find((o) => o.body === 'True')?.isCorrect).toBe(true);
    });

    it('records a mark changed after the results were out, with the mark it replaced', async () => {
      expectStatus(await student.post(`/attempts/${attemptId}/submit`, {}), 201);
      const schedule = await prisma.testSchedule.findFirstOrThrow({ where: { testId } });
      expectStatus(
        await trainer.post(`/tests/${testId}/schedules/${schedule.id}/release`, {}),
        201,
      );
      const answer = await prisma.testAnswer.findFirstOrThrow({ where: { attemptId } });
      expectStatus(
        await trainer.patch(`/attempts/${attemptId}/answers/${answer.id}/grade`, {
          marks: 1,
          comment: 'Given on review',
        }),
        200,
      );
      const entry = await prisma.auditLog.findFirst({
        where: { action: 'attempt.answer_remarked', resourceId: attemptId },
      });
      expect(entry, 'the re-mark is on record').not.toBeNull();
      expect(entry!.before).toMatchObject({ marks: Number(answer.marks) });
    });

    it('takes code onto a paper only while its check passes', async () => {
      const lab = expectStatus(
        await superAdmin.post('/questions', {
          title: `Checked code ${unique}`,
          body: 'Print the sum.',
          type: 'coding',
          subject: 'javascript',
          difficulty: 'foundation',
          marks: 2,
          coding: {
            languages: ['python'],
            referenceSolution: { python: '# @sum' },
            testCases: [{ input: '1 2\n', expectedOutput: '3', isSample: true }],
          },
        }),
        201,
      ).body as QuestionSummary;
      expectStatus(await superAdmin.post(`/questions/${lab.id}/validate`), 201);
      expectStatus(
        await superAdmin.post(`/questions/${lab.id}/status`, { status: 'published' }),
        201,
      );
      const detail = expectStatus(await superAdmin.get(`/questions/${lab.id}`), 200)
        .body as QuestionDetail;
      // Changing a case means the check must run again: until then no paper takes it.
      expectStatus(
        await superAdmin.put(`/questions/${lab.id}`, {
          title: `Checked code ${unique}`,
          body: 'Print the sum.',
          type: 'coding',
          subject: 'javascript',
          difficulty: 'foundation',
          marks: 2,
          coding: {
            languages: ['python'],
            referenceSolution: { python: '# @sum' },
            testCases: detail.coding!.testCases.map((c) => ({ ...c, expectedOutput: '4' })),
          },
        }),
        200,
      );
      const paperTest = (
        expectStatus(
          await superAdmin.post('/tests', { title: `Unchecked ${unique}`, kind: 'weekly' }),
          201,
        ).body as TestSummary
      ).id;
      const refused = await superAdmin.put(`/tests/${paperTest}/paper`, {
        sections: [{ title: 'One', instructions: '', questions: [{ questionId: lab.id }] }],
      });
      expect(refused.status).toBe(400);
      expect(JSON.stringify(refused.body)).toContain('run the check again');
    });
  });

  // ───────────────────────── SEC-06: what is recorded ─────────────────────────

  describe('the audit trail of sensitive actions', () => {
    let documentFileId = '';

    beforeAll(async () => {
      const key = `test/scope/${unique}/proof.pdf`;
      const owner = await prisma.user.findUniqueOrThrow({
        where: { email: TEST_ACCOUNTS.superAdmin.email },
      });
      documentFileId = (
        await prisma.file.create({
          data: {
            organizationId,
            ownerType: 'student-document',
            uploadedById: owner.id,
            driver: 's3',
            bucket: 'lms-private',
            key,
            originalName: 'proof.pdf',
            mime: 'application/pdf',
            size: PDF.byteLength,
            visibility: 'private',
            status: 'ready',
          },
        })
      ).id;
      await app.get<StorageDriver>(STORAGE_DRIVER).put('private', key, PDF, 'application/pdf');
    });

    it('records each broadcast, and who sent it', async () => {
      const sender = await prisma.user.findUniqueOrThrow({
        where: { email: TEST_ACCOUNTS.trainer.email },
      });
      const sent = expectStatus(
        await trainer.post('/notifications/broadcast', {
          title: `Batch notice ${unique}`,
          body: 'Bring your laptops.',
          audience: { roleKeys: [], batchIds: [batchId], programIds: [] },
        }),
        202,
      ).body as { recipients: number };
      expect(sent.recipients).toBeGreaterThan(0);
      const entry = await prisma.auditLog.findFirst({
        where: { action: 'notifications.broadcast', actorId: sender.id },
        orderBy: { occurredAt: 'desc' },
      });
      expect(entry?.after).toMatchObject({ title: `Batch notice ${unique}` });
    });

    it('records a link to someone else’s personal file', async () => {
      expectStatus(await admin.get(`/files/${documentFileId}/url`), 200);
      expect(
        await prisma.auditLog.count({
          where: { action: 'files.personal_link_issued', resourceId: documentFileId },
        }),
      ).toBe(1);
    });

    it('never shows a private file as branding', async () => {
      const refused = await superAdmin.patch('/branding', { logoLightFileId: documentFileId });
      expect(refused.status).toBe(400);
    });
  });

  // ───────────────────────── SEC-05: exports ─────────────────────────

  describe('an export', () => {
    it('is held to the export permission’s scope, not only the reading one', async () => {
      const role = expectStatus(
        await superAdmin.post('/roles', { key: `exporter_${unique}`, name: `Exporter ${unique}` }),
        201,
      ).body as { id: string };
      expectStatus(
        await superAdmin.put(`/roles/${role.id}/permissions`, [
          { permissionKey: 'reports:read', scope: 'all' },
          { permissionKey: 'reports:export', scope: 'batch' },
        ]),
        200,
      );
      const person = await account('exporter', `exporter_${unique}`);
      const exporter = await signIn(person.email);
      const read = expectStatus(await exporter.get('/reports/students?pageSize=1'), 200)
        .body as ReportData;
      expect(read.meta.total).toBeGreaterThan(0);
      const job = expectStatus(
        await exporter.post('/exports', { report: 'students', format: 'csv', params: {} }),
        201,
      ).body as ExportJobRecord;
      const finished = expectStatus(await exporter.get(`/exports/${job.id}`), 200)
        .body as ExportJobRecord;
      expect(finished.status).toBe('ready');
      expect(finished.rowCount, 'they export the batches they teach: none').toBe(0);
    });
  });

  // ───────────────────────── SEC-05: labs ─────────────────────────

  describe('a lab’s attempts', () => {
    it('are read only for a lab the reviewer may read', async () => {
      const draft = expectStatus(
        await superAdmin.post('/questions', {
          title: `Draft lab ${unique}`,
          body: 'Not ready.',
          type: 'coding',
          subject: 'javascript',
          difficulty: 'foundation',
          marks: 1,
          coding: {
            languages: ['python'],
            referenceSolution: { python: '# @sum' },
            testCases: [{ input: '1 2\n', expectedOutput: '3', isSample: true }],
          },
        }),
        201,
      ).body as QuestionSummary;
      expect((await trainer.get(`/practice/labs/${draft.id}/attempts`)).status).toBe(403);
      expectStatus(await superAdmin.get(`/practice/labs/${draft.id}/attempts`), 200);
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
