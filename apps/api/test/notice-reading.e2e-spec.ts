import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { SYSTEM_ROLES, type CourseSummary, type QuestionSummary } from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { NotificationsService } from '../src/modules/notifications/index.js';
import { createTestApp } from './setup/app.js';
import { eventually } from './setup/eventually.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

/**
 * Phase 5: opening the page a notice leads to reads that notice — and no other. Each case puts
 * notices in the learner's bell with the links the platform writes, opens one page, and checks
 * which were read.
 */
describe('reading notices by opening their page', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let notices: NotificationsService;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);

  let organizationId = '';
  let batchId = '';
  let courseId = '';
  let lessonId = '';
  let assignmentId = '';
  let placementId = '';
  let testId = '';
  const learners: Record<string, { userId: string; studentId: string; session: Session }> = {};
  const cleanup: (() => Promise<unknown>)[] = [];

  async function learner(label: string) {
    const role = await prisma.role.findFirstOrThrow({
      where: { organizationId, key: SYSTEM_ROLES.STUDENT },
    });
    const email = `read-${label}-${unique}@test.local`;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `Reader ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
      },
    });
    const profile = await prisma.studentProfile.create({
      data: { userId: user.id, studentCode: `STU-READ-${label}-${unique}`, status: 'active' },
    });
    const session = new Session(app);
    expectStatus(await session.login(email, password), 200);
    learners[label] = { userId: user.id, studentId: profile.id, session };
  }

  /** Puts a notice with this link in a learner's bell, as the platform would. */
  async function notice(who: string, link: string, category = 'assessment') {
    await notices.deliverNow({
      category: category as 'assessment',
      type: 'test.notice',
      title: `${link} ${unique}`,
      body: '',
      link,
      channels: ['in_app'],
      userIds: [learners[who]!.userId],
    });
  }

  /** Whether each listed link's notice is still unread for a learner. */
  async function unread(who: string, links: string[]): Promise<Record<string, boolean>> {
    const out: Record<string, boolean> = {};
    for (const link of links) {
      const row = await prisma.notification.findFirstOrThrow({
        where: { userId: learners[who]!.userId, link, title: `${link} ${unique}` },
      });
      out[link] = row.readAt === null;
    }
    return out;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    notices = app.get(NotificationsService);
    organizationId = (await prisma.organization.findFirstOrThrow()).id;
    admin = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);

    const programId = (
      expectStatus(
        await admin.post('/programs', {
          code: `READ-${unique}`,
          name: `Reading ${unique}`,
          durationWeeks: 12,
        }),
        201,
      ).body as { id: string }
    ).id;
    batchId = (
      expectStatus(
        await admin.post('/batches', {
          programId,
          code: `READ-${unique}-B1`,
          name: 'Reading B1',
          startDate: '2026-01-05',
          endDate: '2026-12-18',
        }),
        201,
      ).body as { id: string }
    ).id;
    await learner('reader');
    await learner('neighbour');
    expectStatus(
      await admin.post(`/batches/${batchId}/members`, {
        studentIds: [learners.reader!.studentId, learners.neighbour!.studentId],
      }),
      201,
    );

    // A course with one lesson, published to the batch: the real "course.published" notice.
    courseId = (
      expectStatus(
        await admin.post('/courses', { title: `Reading course ${unique}`, level: 'beginner' }),
        201,
      ).body as CourseSummary
    ).id;
    cleanup.push(() => admin.delete(`/courses/${courseId}`));
    expectStatus(
      await admin.put(`/courses/${courseId}/outline`, {
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
    expectStatus(
      await admin.post(`/courses/${courseId}/publish`, { scopeType: 'batch', scopeId: batchId }),
      201,
    );
    lessonId = (await prisma.lesson.findFirstOrThrow({ where: { module: { courseId } } })).id;

    // An assignment of one question, and a test of one question with a live window.
    const question = expectStatus(
      await admin.post('/questions', {
        title: `Reading check ${unique}`,
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
    expectStatus(
      await admin.post(`/questions/${question.id}/status`, { status: 'published' }),
      201,
    );
    assignmentId = (
      expectStatus(
        await admin.post('/assignments', {
          title: `Reading assignment ${unique}`,
          subject: 'javascript',
          difficulty: 'beginner',
          kind: 'mixed',
        }),
        201,
      ).body as { id: string }
    ).id;
    cleanup.push(() => admin.delete(`/assignments/${assignmentId}`));
    const structured = expectStatus(
      await admin.put(`/assignments/${assignmentId}/structure`, {
        modules: [
          {
            title: 'Only',
            unlockRule: { type: 'always' },
            questions: [{ questionId: question.id }],
          },
        ],
      }),
      200,
    ).body as { modules: { questions: { id: string }[] }[] };
    placementId = structured.modules[0]!.questions[0]!.id;
    expectStatus(
      await admin.post(`/assignments/${assignmentId}/publish`, {
        batchId,
        opensAt: new Date(Date.now() - 60_000).toISOString(),
      }),
      201,
    );
    testId = (
      expectStatus(
        await admin.post('/tests', {
          title: `Reading test ${unique}`,
          kind: 'practice',
          settings: {
            durationMinutes: 10,
            maxAttempts: 1,
            shuffleQuestions: false,
            shuffleOptions: false,
            resultPolicy: 'immediately',
            reviewPolicy: 'full',
            trackTabSwitches: false,
            requireFullScreen: false,
            showRank: false,
          },
        }),
        201,
      ).body as { id: string }
    ).id;
    expectStatus(
      await admin.put(`/tests/${testId}/paper`, {
        sections: [{ title: 'Only section', questions: [{ questionId: question.id }] }],
      }),
      200,
    );
    expectStatus(await admin.post(`/tests/${testId}/status`, { status: 'published' }), 201);
    expectStatus(
      await admin.post(`/tests/${testId}/schedules`, {
        batchId,
        opensAt: new Date(Date.now() - 60_000).toISOString(),
        closesAt: new Date(Date.now() + 3_600_000).toISOString(),
      }),
      201,
    );
  });

  afterAll(async () => {
    for (const step of cleanup) await step();
    await app.close();
  });

  it('reads a course’s notice on the course, and a recording’s on its lesson', async () => {
    const published = await eventually(
      () =>
        prisma.notification.findFirst({
          where: { userId: learners.reader!.userId, link: `/courses/${courseId}` },
        }),
      (row) => row !== null,
    );
    expect(published?.readAt).toBeNull();
    const lessonLink = `/courses/${courseId}/lessons/${lessonId}`;
    await notice('reader', lessonLink, 'content');
    await notice('reader', '/courses/elsewhere', 'content');

    expectStatus(await learners.reader!.session.get(`/courses/${courseId}`), 200);
    expect(
      (await prisma.notification.findUniqueOrThrow({ where: { id: published!.id } })).readAt,
    ).not.toBeNull();
    expect(await unread('reader', [lessonLink, '/courses/elsewhere'])).toEqual({
      [lessonLink]: true,
      '/courses/elsewhere': true,
    });

    expectStatus(await learners.reader!.session.get(`/lessons/${lessonId}`), 200);
    expect(await unread('reader', [lessonLink, '/courses/elsewhere'])).toEqual({
      [lessonLink]: false,
      '/courses/elsewhere': true,
    });
  });

  it('reads an assignment’s notices on it, and a review only on its question', async () => {
    const page = `/assignments/${assignmentId}`;
    const review = `/assignments/${assignmentId}/q/${placementId}`;
    const otherReview = `/assignments/${assignmentId}/q/someone-else`;
    for (const link of [review, otherReview, '/assignments/another']) await notice('reader', link);
    await notice('neighbour', review);

    expectStatus(await learners.reader!.session.get(`/me/assignments/${assignmentId}`), 200);
    const published = await prisma.notification.findFirstOrThrow({
      where: { userId: learners.reader!.userId, type: 'assignment.published', link: page },
    });
    expect(published.readAt).not.toBeNull();
    expect(await unread('reader', [review, otherReview, '/assignments/another'])).toEqual({
      [review]: true,
      [otherReview]: true,
      '/assignments/another': true,
    });

    expectStatus(
      await learners.reader!.session.get(
        `/me/assignments/${assignmentId}/questions/${placementId}`,
      ),
      200,
    );
    expect(await unread('reader', [review, otherReview])).toEqual({
      [review]: false,
      [otherReview]: true,
    });
    // Another learner's notice with the same link is theirs to read.
    expect(await unread('neighbour', [review])).toEqual({ [review]: true });
  });

  it('reads a released result on the result page, whichever attempt its link names', async () => {
    const reader = learners.reader!.session;
    const state = expectStatus(await reader.post(`/tests/${testId}/attempts`), 201).body as {
      attemptId: string;
    };
    expectStatus(await reader.post(`/attempts/${state.attemptId}/submit`, {}), 201);
    const released = `/tests/${testId}/result`;
    const remarked = `/tests/${testId}/result?attempt=${state.attemptId}`;
    const closing = `/tests/${testId}`;
    for (const link of [released, remarked, closing]) await notice('reader', link);

    expectStatus(await reader.get(`/attempts/${state.attemptId}/result`), 200);
    expect(await unread('reader', [released, remarked, closing])).toEqual({
      [released]: false,
      [remarked]: false,
      [closing]: true,
    });

    // The instructions page loads from the test list, so it says itself it has been opened.
    expect(
      expectStatus(await reader.post('/me/notifications/read-page', { path: closing }), 200).body,
    ).toEqual({ marked: 1 });
    expect(await unread('reader', [closing])).toEqual({ [closing]: false });
    const refused = await reader.post('/me/notifications/read-page', {
      path: 'https://elsewhere.example/tests',
    });
    expect(refused.status).toBe(400);
    expect(problemCode(refused)).toBe('validation_failed');
  });

  it('reads certificate notices on the certificates page', async () => {
    await notice('reader', '/certificates', 'content');
    await notice('reader', '/profile/documents', 'account');
    expectStatus(await learners.reader!.session.get('/me/certificates'), 200);
    expect(await unread('reader', ['/certificates', '/profile/documents'])).toEqual({
      '/certificates': false,
      '/profile/documents': true,
    });
    expectStatus(await learners.reader!.session.get('/me/documents'), 200);
    expect(await unread('reader', ['/profile/documents'])).toEqual({ '/profile/documents': false });
  });

  it('reads announcements shown in the centre, not by the bell, and only those shown', async () => {
    await notice('reader', '/notifications', 'announcement');
    await notice('reader', '/assignments/elsewhere', 'assessment');
    // The bell polls: nothing is read by it.
    expectStatus(await learners.reader!.session.get('/me/notifications/summary'), 200);
    expect(await unread('reader', ['/notifications'])).toEqual({ '/notifications': true });
    // The centre filtered to another category does not show, and so does not read, it.
    expectStatus(
      await learners.reader!.session.get('/me/notifications?category=assessment&pageSize=50'),
      200,
    );
    expect(await unread('reader', ['/notifications', '/assignments/elsewhere'])).toEqual({
      '/notifications': true,
      '/assignments/elsewhere': true,
    });
    // Shown in full in the centre: read, and the answer still shows how it stood.
    const page = expectStatus(
      await learners.reader!.session.get('/me/notifications?pageSize=50'),
      200,
    ).body as { data: { link: string | null; title: string; readAt: string | null }[] };
    expect(page.data.find((n) => n.title === `/notifications ${unique}`)?.readAt).toBeNull();
    expect(await unread('reader', ['/notifications', '/assignments/elsewhere'])).toEqual({
      '/notifications': false,
      '/assignments/elsewhere': true,
    });
  });

  it('reads a trainer’s roll-call notice on the roll call, and an export’s on the exports page', async () => {
    const trainer = new Session(app);
    expectStatus(await trainer.login(TEST_ACCOUNTS.trainer.email, password), 200);
    const trainerUser = await prisma.user.findUniqueOrThrow({
      where: { email: TEST_ACCOUNTS.trainer.email },
    });
    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { email: TEST_ACCOUNTS.superAdmin.email },
    });
    const trainerId = (
      await prisma.trainerProfile.findFirstOrThrow({ where: { userId: trainerUser.id } })
    ).id;
    const startsAt = new Date(Date.now() - 4 * 86_400_000);
    startsAt.setUTCHours(17, 0, 0, 0);
    // The roll call is the batch's trainers': this one teaches it for the length of the test.
    const teaching = await prisma.batchTrainer.create({
      data: { batchId, trainerId, subject: 'Core Java' },
    });
    const lesson = await prisma.liveSession.create({
      data: {
        batchId,
        trainerId,
        subject: 'Core Java',
        title: `Unmarked class ${unique}`,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 3_600_000),
        status: 'completed',
      },
    });
    try {
      const rollCall = `/trainer/sessions/${lesson.id}/attendance`;
      const otherRollCall = '/trainer/sessions/someone-else/attendance';
      for (const [userId, link] of [
        [trainerUser.id, rollCall],
        [trainerUser.id, otherRollCall],
        [adminUser.id, '/admin/exports'],
      ] as const) {
        await notices.deliverNow({
          category: 'attendance',
          type: 'test.notice',
          title: `${link} ${unique}`,
          body: '',
          link,
          channels: ['in_app'],
          userIds: [userId],
        });
      }
      const state = async (userId: string, link: string) =>
        (
          await prisma.notification.findFirstOrThrow({
            where: { userId, link, title: `${link} ${unique}` },
          })
        ).readAt === null;

      expectStatus(await trainer.get(`/sessions/${lesson.id}/attendance`), 200);
      expect(await state(trainerUser.id, rollCall)).toBe(false);
      expect(await state(trainerUser.id, otherRollCall)).toBe(true);

      expectStatus(await admin.get('/exports'), 200);
      expect(await state(adminUser.id, '/admin/exports')).toBe(false);
    } finally {
      await prisma.liveSession.deleteMany({ where: { id: lesson.id } });
      await prisma.batchTrainer.delete({ where: { id: teaching.id } });
    }
  });
});
