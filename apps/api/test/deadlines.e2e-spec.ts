import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { SYSTEM_ROLES, type QuestionSummary } from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { DueRemindersService } from '../src/modules/assignments/due-reminders.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus } from './setup/http.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

/**
 * Phase 5: deadline notices worked out per learner from the state their assignment page shows —
 * their own dates (an extension first, else the batch's), whether their work is in, whether late
 * work is still taken — and sent to each learner once per assignment and due date. The job takes
 * the time as an argument, so "three hours later" needs no waiting.
 */
describe('deadline notices', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let reminders: DueRemindersService;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  const HOUR = 3_600_000;
  const now = new Date();
  const later = new Date(now.getTime() + 3 * HOUR);

  let organizationId = '';
  let batchId = '';
  let questionId = '';
  const learners: Record<string, { userId: string; studentId: string; session: Session }> = {};
  const assignments: Record<string, { id: string; placement: string }> = {};

  async function learner(label: string) {
    const role = await prisma.role.findFirstOrThrow({
      where: { organizationId, key: SYSTEM_ROLES.STUDENT },
    });
    const email = `due-${label}-${unique}@test.local`;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `Deadline ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
      },
    });
    const profile = await prisma.studentProfile.create({
      data: { userId: user.id, studentCode: `STU-DUE-${label}-${unique}`, status: 'active' },
    });
    const session = new Session(app);
    expectStatus(await session.login(email, password), 200);
    learners[label] = { userId: user.id, studentId: profile.id, session };
  }

  async function assignment(label: string, dueInHours: number, duePolicy = 'allow_late') {
    const created = expectStatus(
      await admin.post('/assignments', {
        title: `Deadline ${label} ${unique}`,
        subject: 'javascript',
        difficulty: 'beginner',
        kind: 'mixed',
        settings: { duePolicy },
      }),
      201,
    ).body as { id: string };
    const structured = expectStatus(
      await admin.put(`/assignments/${created.id}/structure`, {
        modules: [{ title: 'Only', unlockRule: { type: 'always' }, questions: [{ questionId }] }],
      }),
      200,
    ).body as { modules: { questions: { id: string }[] }[] };
    expectStatus(
      await admin.post(`/assignments/${created.id}/publish`, {
        batchId,
        opensAt: new Date(now.getTime() - HOUR).toISOString(),
        dueAt: new Date(now.getTime() + dueInHours * HOUR).toISOString(),
      }),
      201,
    );
    assignments[label] = { id: created.id, placement: structured.modules[0]!.questions[0]!.id };
  }

  /** The notices of one type about one assignment, per learner label. */
  async function notices(type: string, label: string): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const [who, person] of Object.entries(learners)) {
      out[who] = await prisma.notification.count({
        where: { userId: person.userId, type, link: `/assignments/${assignments[label]!.id}` },
      });
    }
    return out;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    reminders = app.get(DueRemindersService);
    organizationId = (await prisma.organization.findFirstOrThrow()).id;
    admin = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);

    const programId = (
      expectStatus(
        await admin.post('/programs', {
          code: `DUE-${unique}`,
          name: `Deadlines ${unique}`,
          durationWeeks: 12,
        }),
        201,
      ).body as { id: string }
    ).id;
    batchId = (
      expectStatus(
        await admin.post('/batches', {
          programId,
          code: `DUE-${unique}-B1`,
          name: 'Deadlines B1',
          startDate: '2026-01-05',
          endDate: '2026-12-18',
        }),
        201,
      ).body as { id: string }
    ).id;
    for (const label of ['pending', 'done', 'left', 'extended', 'deactivated']) {
      await learner(label);
    }
    expectStatus(
      await admin.post(`/batches/${batchId}/members`, {
        studentIds: Object.values(learners).map((l) => l.studentId),
      }),
      201,
    );

    const question = expectStatus(
      await admin.post('/questions', {
        title: `Deadline check ${unique}`,
        body: 'Pick the true one.',
        type: 'mcq_single',
        subject: 'javascript',
        difficulty: 'easy',
        marks: 1,
        options: [
          { body: 'True', isCorrect: true },
          { body: 'False', isCorrect: false },
        ],
      }),
      201,
    ).body as QuestionSummary;
    questionId = question.id;
    expectStatus(await admin.post(`/questions/${questionId}/status`, { status: 'published' }), 201);

    await assignment('far', 72);
    await assignment('soon', 6);
    await assignment('passing', 2);
    await assignment('strict', 2, 'block_late');

    // "done" hands in the passing assignment; "left" leaves the batch; "extended" is given two
    // more days; "deactivated" loses their account.
    const passing = assignments.passing!;
    const workspace = expectStatus(
      await learners.done!.session.get(
        `/me/assignments/${passing.id}/questions/${passing.placement}`,
      ),
      200,
    ).body as { question: { options: { id: string; body: string }[] } };
    expectStatus(
      await learners.done!.session.post(
        `/me/assignments/${passing.id}/questions/${passing.placement}/submissions`,
        { optionIds: [workspace.question.options.find((o) => o.body === 'True')!.id] },
      ),
      201,
    );
    expectStatus(
      await admin.delete(`/batches/${batchId}/members/${learners.left!.studentId}`),
      204,
    );
    expectStatus(
      await admin.post(`/assignments/${passing.id}/publish`, {
        studentIds: [learners.extended!.studentId],
        dueAt: new Date(now.getTime() + 48 * HOUR).toISOString(),
      }),
      201,
    );
    expectStatus(
      await admin.post(`/users/${learners.deactivated!.userId}/deactivate`, { reason: 'Gone' }),
      204,
    );
  });

  afterAll(async () => {
    for (const { id } of Object.values(assignments)) await admin.delete(`/assignments/${id}`);
    await app.close();
  });

  it('reminds a day ahead only learners with work still to do', async () => {
    await reminders.remind(now);
    // Not due for three days: nothing yet.
    expect(Object.values(await notices('assignment.due_soon', 'far'))).toEqual([0, 0, 0, 0, 0]);
    // Due in six hours: everyone still in the batch with work to do.
    expect(await notices('assignment.due_soon', 'soon')).toEqual({
      pending: 1,
      done: 1,
      left: 0,
      extended: 1,
      deactivated: 0,
    });
    // Due in two hours, but "done" has handed it in and "extended" is due in two days.
    expect(await notices('assignment.due_soon', 'passing')).toMatchObject({
      pending: 1,
      done: 0,
      extended: 0,
    });
  });

  it('tells only learners whose work is overdue and still accepted', async () => {
    // Before the due date nothing is overdue.
    await reminders.overdue(now);
    expect(Object.values(await notices('assignment.overdue', 'passing'))).toEqual([0, 0, 0, 0, 0]);

    // Three hours later the passing assignment is overdue for the one who has not handed in.
    await reminders.overdue(later);
    expect(await notices('assignment.overdue', 'passing')).toEqual({
      pending: 1,
      done: 0,
      left: 0,
      extended: 0,
      deactivated: 0,
    });
    // One that refuses late work has closed instead: nothing to chase.
    expect(Object.values(await notices('assignment.overdue', 'strict'))).toEqual([0, 0, 0, 0, 0]);
    // The others are not due yet.
    expect(Object.values(await notices('assignment.overdue', 'soon'))).toEqual([0, 0, 0, 0, 0]);
    const notice = await prisma.notification.findFirstOrThrow({
      where: { userId: learners.pending!.userId, type: 'assignment.overdue' },
    });
    expect(notice.title).toContain('Overdue');
    expect(notice.link).toBe(`/assignments/${assignments.passing!.id}`);
  });

  it('sends each notice once, however often or however simultaneously the job runs', async () => {
    await reminders.overdue(later);
    await Promise.all([reminders.overdue(later), reminders.overdue(later)]);
    await Promise.all([reminders.remind(now), reminders.remind(now)]);
    expect((await notices('assignment.overdue', 'passing')).pending).toBe(1);
    expect((await notices('assignment.due_soon', 'soon')).pending).toBe(1);
    expect((await notices('assignment.due_soon', 'passing')).pending).toBe(1);
  });
});
