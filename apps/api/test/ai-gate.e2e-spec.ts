import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  AI_FEATURE_FLAGS,
  AI_MODULE_FLAG,
  SYSTEM_ROLES,
  type AiAvailability,
  type AiConversationSummary,
  type MeResponse,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import type { AiChatRequest } from '../src/modules/ai/providers/ai-provider.js';
import { usageDayOf } from '../src/modules/ai/usage/usage.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp } from './setup/app.js';
import { eventually } from './setup/eventually.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { ScriptedAiProvider, parseEvents } from './setup/scripted-ai.provider.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

const AI_ENV = {
  AI_PROVIDER: 'fake',
  AI_TIMEOUT_MS: '3000',
  AI_MODEL_COSTS: 'fake-1=1/2',
  AI_DATA_CLASSES: 'public,course,personal',
};
const AI_FLAGS = [AI_MODULE_FLAG, ...Object.values(AI_FEATURE_FLAGS)];
const PRACTICE_FLAG = 'module.practice';

/** What no lab hint may carry to the provider. */
const PROTECTED = [
  'HIDDEN-CASE-MARKER',
  'HIDDEN-OUTPUT-MARKER',
  'DISABLED-CASE-MARKER',
  'REFERENCE-SOLUTION-MARKER',
  'GRADER-CHECK-MARKER',
  'RUBRIC-MARKER',
  'EXPLANATION-MARKER',
];

type Role = 'student' | 'trainer' | 'admin' | 'superAdmin';
const ROLES: Role[] = ['student', 'trainer', 'admin', 'superAdmin'];

/**
 * The Phase 7 gate (7F): SI Academy AI's rules, checked across every role, flag and surface at
 * once, with a scripted stand-in for the provider (no network, no key). Who may use which route;
 * the kill switch and each surface's own flag; lab hints — a learner's, after a failed submission,
 * on a lab open to them now, with nothing protected sent; no AI at all during a timed test; and an
 * answer with no words. The slices' own specs (7A–7E) go deeper into each.
 */
describe('SI Academy AI — the Phase 7 gate (7F)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: Session;
  let organizationId = '';
  const provider = new ScriptedAiProvider();
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  /** The run's own word, in letters: a question holding figures is never shared in the cache. */
  const word = `q${unique.replace(/\d/g, (d) => 'abcdefghij'[Number(d)]!)}`;
  let counter = 0;

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  async function signedIn(roleKey: string, label: string) {
    counter += 1;
    const role = await prisma.role.findFirstOrThrow({ where: { organizationId, key: roleKey } });
    const email = `ai7f-${label}-${counter}-${unique}@test.local`;
    const learner = roleKey === SYSTEM_ROLES.STUDENT;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `AI 7F ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
        ...(learner
          ? {
              studentProfile: {
                create: { studentCode: `STU-AI7F-${counter}-${unique}`, status: 'active' },
              },
            }
          : {}),
      },
      include: { studentProfile: true },
    });
    const session = new Session(app);
    expectStatus(await session.login(email, password), 200);
    return { session, user, studentId: user.studentProfile?.id ?? '' };
  }

  /** One of each role, and the learner among them; the Super Admin is the seeded one. */
  async function everyone(label: string) {
    const learner = await signedIn(SYSTEM_ROLES.STUDENT, `${label}-student`);
    const people: Record<Role, Session> = {
      student: learner.session,
      trainer: (await signedIn(SYSTEM_ROLES.TRAINER, `${label}-trainer`)).session,
      admin: (await signedIn(SYSTEM_ROLES.ADMIN, `${label}-admin`)).session,
      superAdmin,
    };
    return { people, learner };
  }

  async function setFlag(key: string, enabled: boolean) {
    expectStatus(await superAdmin.patch(`/flags/${key}`, { enabled }), 200);
  }

  async function withFlag<T>(key: string, enabled: boolean, run: () => Promise<T>): Promise<T> {
    await setFlag(key, enabled);
    try {
      return await run();
    } finally {
      await setFlag(key, !enabled);
    }
  }

  /** A lab with everything a hint must never pass on; in the catalogue unless `inPractice` is false. */
  async function lab(options: { inPractice?: boolean; status?: 'published' | 'draft' } = {}) {
    counter += 1;
    const question = await prisma.question.create({
      data: {
        organizationId,
        slug: `ai7f-lab-${counter}-${unique}`,
        title: 'Sum two numbers',
        body: '<p>Read two integers and print their sum.</p>',
        type: 'coding',
        status: options.status ?? 'published',
        inPractice: options.inPractice ?? true,
        validation: { ok: true },
        explanation: 'EXPLANATION-MARKER',
        rubric: 'RUBRIC-MARKER',
      },
    });
    await prisma.codingProblem.create({
      data: {
        questionId: question.id,
        languages: ['python'],
        referenceSolution: { python: 'print(REFERENCE-SOLUTION-MARKER)' },
        sqlCheck: 'GRADER-CHECK-MARKER',
        testCases: {
          create: [
            { input: '1 2', expectedOutput: '3', isSample: true, position: 0 },
            { input: 'DISABLED-CASE-MARKER', isSample: true, enabled: false, position: 1 },
            { input: 'HIDDEN-CASE-MARKER', expectedOutput: 'HIDDEN-OUTPUT-MARKER', position: 2 },
          ],
        },
      },
    });
    return question;
  }

  /** A submission of the learner's own, as the practice routes record it. */
  async function attempt(userId: string, questionId: string, verdict: 'passed' | 'wrong_answer') {
    await prisma.executionRun.create({
      data: {
        questionId,
        userId,
        context: 'practice',
        language: 'python',
        code: `print("${verdict}")`,
        driver: 'runner',
        trust: 'trusted',
        verdict,
        passedCount: verdict === 'passed' ? 2 : 0,
        totalCount: 2,
      },
    });
  }

  /** A published course whose first module opens one lab lesson, and whose locked second another. */
  async function courseWithLabs(openLab: string, lockedLab: string) {
    counter += 1;
    return prisma.course.create({
      data: {
        organizationId,
        slug: `ai7f-course-${counter}-${unique}`,
        title: `Labs course ${counter}`,
        status: 'published',
        modules: {
          create: [
            {
              title: 'Open',
              position: 0,
              lessons: {
                create: [
                  {
                    title: 'Lab one',
                    type: 'lab',
                    position: 0,
                    content: { html: '', video: null, questionId: openLab },
                  },
                ],
              },
            },
            {
              title: 'Locked',
              position: 1,
              unlockRule: { type: 'after_previous', minPercent: 100 },
              lessons: {
                create: [
                  {
                    title: 'Lab two',
                    type: 'lab',
                    position: 0,
                    content: { html: '', video: null, questionId: lockedLab },
                  },
                ],
              },
            },
          ],
        },
      },
    });
  }

  const start = (session: Session, body: object) => session.post('/ai/conversations', body);

  async function started(session: Session, body: object) {
    return (expectStatus(await start(session, body), 201).body as AiConversationSummary).id;
  }

  const ask = (session: Session, id: string, content: string) =>
    session.post(`/ai/conversations/${id}/messages`, { content });

  const questionsSent = () =>
    provider.requests.filter((r) => r.task === 'chat' || r.task === 'hint').length;

  function sentWith(question: string): AiChatRequest {
    const found = provider.requests.filter(
      (r) => (r.task === 'chat' || r.task === 'hint') && r.messages.at(-1)?.content === question,
    );
    expect(found, question).toHaveLength(1);
    return found[0]!;
  }

  beforeAll(async () => {
    Object.assign(process.env, AI_ENV);
    app = await createTestApp({ aiProvider: provider });
    prisma = app.get(PrismaService);
    organizationId = (
      await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.superAdmin.email } })
    ).organizationId;
    superAdmin = new Session(app);
    expectStatus(await superAdmin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    for (const key of AI_FLAGS) await setFlag(key, true);
  });
  afterAll(async () => {
    for (const key of AI_FLAGS) await setFlag(key, false);
    await app.close();
    for (const key of Object.keys(AI_ENV)) delete process.env[key];
  });

  describe('who may use which route', () => {
    it('answers every route as each role’s permissions say, and nothing without signing in', async () => {
      const { people, learner } = await everyone('routes');
      const catalogueLab = await lab();
      const course = await courseWithLabs((await lab()).id, (await lab()).id);
      await prisma.enrollment.create({
        data: { studentId: learner.studentId, courseId: course.id },
      });

      const expected: [string, () => [string, string, object?], Record<Role, number>][] = [
        ['availability', () => ['get', '/ai/availability'], all(200)],
        ['own conversations', () => ['get', '/ai/conversations'], all(200)],
        [
          'a workspace conversation',
          () => ['post', '/ai/conversations', { purpose: 'workspace' }],
          all(201),
        ],
        [
          'an assistant conversation',
          () => ['post', '/ai/conversations', { purpose: 'assistant' }],
          all(201),
        ],
        [
          'the assistant about a course',
          () => [
            'post',
            '/ai/conversations',
            { purpose: 'assistant', context: { courseId: course.id } },
          ],
          // Reach, never managing rights: the Super Admin and administrators reach no course here.
          { student: 201, trainer: 403, admin: 403, superAdmin: 403 },
        ],
        [
          'a lab hint',
          () => [
            'post',
            '/ai/conversations',
            { purpose: 'lab_hint', context: { questionId: catalogueLab.id } },
          ],
          // A learner's alone: the Super Admin's role grants ai:hints, but staff get no hints.
          { student: 201, trainer: 403, admin: 403, superAdmin: 403 },
        ],
        [
          'usage figures',
          () => ['get', '/ai/usage'],
          { student: 403, trainer: 200, admin: 200, superAdmin: 200 },
        ],
        ['the service’s state', () => ['get', '/ai/admin/status'], superOnly()],
        ['the AI settings', () => ['get', '/ai/admin/settings'], superOnly()],
        [
          'a settings change',
          () => ['patch', '/ai/admin/settings', { cacheTtlHours: 168 }],
          superOnly(),
        ],
        ['the cache purge', () => ['post', '/ai/admin/cache/purge'], superOnly()],
      ];
      try {
        for (const [label, route, statuses] of expected) {
          for (const role of ROLES) {
            const [method, path, body] = route();
            const session = people[role];
            const res =
              method === 'get'
                ? await session.get(path)
                : method === 'patch'
                  ? await session.patch(path, body)
                  : await session.post(path, body);
            expect(res.status, `${label} as ${role}`).toBe(statuses[role]);
            if (statuses[role] === 403)
              expect(problemCode(res), `${label} as ${role}`).toBe('forbidden');
          }
        }
      } finally {
        // The Super Admin's settings change above stored the institute's AI settings: they go
        // again, so every later test starts from the deployment's configuration.
        await prisma.setting.deleteMany({ where: { organizationId, key: 'ai' } });
      }
      for (const path of [
        '/ai/availability',
        '/ai/conversations',
        '/ai/usage',
        '/ai/admin/settings',
      ]) {
        expect((await request(server()).get(`/api/v1${path}`)).status, path).toBe(401);
      }
    });

    it('keeps a conversation its owner’s: another’s id is not found to read, ask in or delete', async () => {
      const { people } = await everyone('owner');
      const owner = (await signedIn(SYSTEM_ROLES.STUDENT, 'owner-own')).session;
      const id = await started(owner, { purpose: 'workspace' });
      expect((await ask(owner, id, 'My own question')).status).toBe(200);
      for (const role of ROLES) {
        const session = people[role];
        expect((await session.get(`/ai/conversations/${id}`)).status, role).toBe(404);
        expect((await ask(session, id, 'Someone else’s question')).status, role).toBe(404);
        expect((await session.delete(`/ai/conversations/${id}`)).status, role).toBe(404);
      }
      // A question carries its words alone: no subject, model or anything else rides along.
      const smuggled = await owner.post(`/ai/conversations/${id}/messages`, {
        content: 'Hi',
        context: { courseId: '0190a0e4-7c1d-7b9e-8f00-0000000000c1' },
      });
      expect(smuggled.status).toBe(400);
      expectStatus(await owner.delete(`/ai/conversations/${id}`), 204);
      expect((await owner.get(`/ai/conversations/${id}`)).status).toBe(404);
      expect((await ask(owner, id, 'Still mine?')).status).toBe(404);
    });
  });

  describe('the kill switch and each surface’s own flag', () => {
    it('with module.ai off, refuses every AI route to everyone, offers no menu entry, and calls nothing', async () => {
      const { people } = await everyone('kill');
      const before = questionsSent();
      await withFlag(AI_MODULE_FLAG, false, async () => {
        for (const role of ROLES) {
          const session = people[role];
          for (const res of [
            await session.get('/ai/availability'),
            await session.get('/ai/conversations'),
            await start(session, { purpose: 'workspace' }),
            await session.get('/ai/usage'),
            await session.get('/ai/admin/settings'),
          ]) {
            expect(res.status, role).toBe(403);
            expect(problemCode(res), role).toBe('module_disabled');
          }
          const me = expectStatus(await session.get('/me'), 200).body as MeResponse;
          const keys = Object.values(me.navigation).flatMap((items) => items.map((i) => i.key));
          expect(
            keys.filter((key) => /\.ai(_|$)/.test(key)),
            role,
          ).toEqual([]);
        }
      });
      expect(questionsSent()).toBe(before);
    });

    it('needs each surface’s own flag as well as the module’s, and leaves the others alone', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'flags');
      const sum = await lab();
      await attempt(learner.user.id, sum.id, 'wrong_answer');
      const surfaces = [
        [AI_FEATURE_FLAGS.workspace, 'workspace', { purpose: 'workspace' }],
        [AI_FEATURE_FLAGS.assistant, 'assistant', { purpose: 'assistant' }],
        [
          AI_FEATURE_FLAGS.lab_hints,
          'lab_hints',
          { purpose: 'lab_hint', context: { questionId: sum.id } },
        ],
      ] as const;
      const open: Record<string, string> = {};
      for (const [, name, body] of surfaces) open[name] = await started(learner.session, body);
      const before = questionsSent();
      for (const [flag, name, body] of surfaces) {
        await withFlag(flag, false, async () => {
          const created = await start(learner.session, body);
          expect(created.status, name).toBe(403);
          expect(problemCode(created), name).toBe('ai_feature_disabled');
          const asked = await ask(learner.session, open[name]!, `Off: ${name}`);
          expect(asked.status, name).toBe(403);
          expect(problemCode(asked), name).toBe('ai_feature_disabled');
          const availability = expectStatus(await learner.session.get('/ai/availability'), 200)
            .body as AiAvailability;
          expect(availability.features[name], name).toBe(false);
          // The other surfaces stay as they were.
          for (const [, other, otherBody] of surfaces) {
            if (other !== name)
              expect((await start(learner.session, otherBody)).status, other).toBe(201);
          }
        });
      }
      expect(questionsSent()).toBe(before);
    });
  });

  describe('lab hints: a learner’s, after a failed submission, on a lab open to them now', () => {
    it('hints after one failed submission, not before and not after an accepted one, and sends nothing protected', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'policy');
      const sum = await lab();
      const id = await started(learner.session, {
        purpose: 'lab_hint',
        context: { questionId: sum.id },
      });
      const none = await ask(learner.session, id, 'A hint before trying');
      expect(none.status).toBe(422);
      expect(problemCode(none)).toBe('ai_hint_needs_attempt');
      await attempt(learner.user.id, sum.id, 'passed');
      expect(problemCode(await ask(learner.session, id, 'A hint after passing'))).toBe(
        'ai_hint_needs_attempt',
      );
      await attempt(learner.user.id, sum.id, 'wrong_answer');
      expect((await ask(learner.session, id, 'A hint after a failed submission')).status).toBe(200);
      const sent = JSON.stringify(sentWith('A hint after a failed submission'));
      for (const marker of PROTECTED) expect(sent, marker).not.toContain(marker);
      expect(sent).toContain('Read two integers and print their sum.');
    });

    it('refuses staff, previews, Labs switched off, and a lab reached only through a lesson they cannot open', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'reach');
      const { people } = await everyone('staff');
      const catalogue = await lab();
      // Staff, the Super Admin included: no hint, even on the catalogue's labs.
      for (const role of ['trainer', 'admin', 'superAdmin'] as const) {
        const res = await start(people[role], {
          purpose: 'lab_hint',
          context: { questionId: catalogue.id },
        });
        expect(res.status, role).toBe(403);
      }
      // A draft — what staff preview — is no lab to a learner.
      const draft = await lab({ status: 'draft' });
      expect(
        (await start(learner.session, { purpose: 'lab_hint', context: { questionId: draft.id } }))
          .status,
      ).toBe(404);

      // Labs switched off: no hint to start, none in a conversation already open.
      await attempt(learner.user.id, catalogue.id, 'wrong_answer');
      const open = await started(learner.session, {
        purpose: 'lab_hint',
        context: { questionId: catalogue.id },
      });
      await withFlag(PRACTICE_FLAG, false, async () => {
        expect(
          (
            await start(learner.session, {
              purpose: 'lab_hint',
              context: { questionId: catalogue.id },
            })
          ).status,
        ).toBe(403);
        expect((await ask(learner.session, open, 'Labs are off')).status).toBe(403);
      });
      expect((await ask(learner.session, open, 'Labs are on again')).status).toBe(200);

      // Labs placed only in a course's lessons: the lesson's own rules decide.
      const openLab = await lab({ inPractice: false });
      const lockedLab = await lab({ inPractice: false });
      const course = await courseWithLabs(openLab.id, lockedLab.id);
      const enrolment = await prisma.enrollment.create({
        data: { studentId: learner.studentId, courseId: course.id },
      });
      await attempt(learner.user.id, openLab.id, 'wrong_answer');
      await attempt(learner.user.id, lockedLab.id, 'wrong_answer');
      const viaLesson = await started(learner.session, {
        purpose: 'lab_hint',
        context: { questionId: openLab.id },
      });
      expect((await ask(learner.session, viaLesson, 'A hint on the lesson lab')).status).toBe(200);
      const locked = await start(learner.session, {
        purpose: 'lab_hint',
        context: { questionId: lockedLab.id },
      });
      expect(locked.status).toBe(403);
      expect(problemCode(locked)).toBe('module_locked');

      const before = questionsSent();
      await prisma.enrollment.update({
        where: { id: enrolment.id },
        data: { status: 'withdrawn' },
      });
      expect((await ask(learner.session, viaLesson, 'Withdrawn now')).status).toBe(403);
      expect(
        (await start(learner.session, { purpose: 'lab_hint', context: { questionId: openLab.id } }))
          .status,
      ).toBe(403);
      await prisma.enrollment.update({ where: { id: enrolment.id }, data: { status: 'active' } });
      await prisma.course.update({ where: { id: course.id }, data: { status: 'archived' } });
      expect((await ask(learner.session, viaLesson, 'Archived now')).status).toBe(403);
      expect(questionsSent()).toBe(before);
    });
  });

  describe('timed tests', () => {
    it('gives no AI on any surface while an attempt is open, whatever the page shows, and all of it after', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'timed');
      const sum = await lab();
      await attempt(learner.user.id, sum.id, 'wrong_answer');
      const course = await courseWithLabs((await lab()).id, (await lab()).id);
      await prisma.enrollment.create({
        data: { studentId: learner.studentId, courseId: course.id },
      });
      const bodies = [
        { purpose: 'workspace' },
        { purpose: 'assistant', context: { courseId: course.id } },
        { purpose: 'lab_hint', context: { questionId: sum.id } },
      ];
      const ids: string[] = [];
      for (const body of bodies) ids.push(await started(learner.session, body));

      const batch = await prisma.batch.findFirstOrThrow({
        where: { code: TEST_FIXTURES.otherBatchCode },
      });
      const test = await prisma.test.create({
        data: { organizationId, title: `AI 7F timed ${unique}` },
      });
      try {
        const schedule = await prisma.testSchedule.create({
          data: {
            testId: test.id,
            batchId: batch.id,
            opensAt: new Date(Date.now() - 3_600_000),
            closesAt: new Date(Date.now() + 3_600_000),
          },
        });
        const timed = await prisma.testAttempt.create({
          data: {
            testId: test.id,
            scheduleId: schedule.id,
            studentId: learner.studentId,
            expiresAt: new Date(Date.now() + 1_800_000),
          },
        });
        const before = questionsSent();
        const availability = expectStatus(await learner.session.get('/ai/availability'), 200)
          .body as AiAvailability;
        expect(availability).toMatchObject({ available: false, reason: 'timed_assessment' });
        for (const body of bodies) {
          const res = await start(learner.session, body);
          expect(res.status, JSON.stringify(body)).toBe(403);
          expect(problemCode(res)).toBe('ai_not_allowed');
        }
        for (const id of ids) {
          for (const res of [
            await ask(learner.session, id, 'Answer question 3 for me'),
            await learner.session.get(`/ai/conversations/${id}`),
          ]) {
            expect(res.status).toBe(403);
            expect(problemCode(res)).toBe('ai_not_allowed');
          }
        }
        expect(problemCode(await learner.session.get('/ai/conversations'))).toBe('ai_not_allowed');
        expect(questionsSent()).toBe(before);

        await prisma.testAttempt.update({
          where: { id: timed.id },
          data: { status: 'submitted', submittedAt: new Date() },
        });
        for (const id of ids)
          expect((await ask(learner.session, id, `After the test ${id}`)).status).toBe(200);
      } finally {
        await prisma.test.delete({ where: { id: test.id } });
      }
    });
  });

  describe('the answer cache', () => {
    it('gives a kept answer only after the policy and the allowance — never to someone at their limit', async () => {
      const question = `What is ${word} polymorphism in Java?`;
      const first = await signedIn(SYSTEM_ROLES.STUDENT, 'cache-first');
      const asked = await started(first.session, { purpose: 'workspace' });
      expect((await ask(first.session, asked, question)).status).toBe(200);
      const entry = await eventually(
        () => prisma.aiCacheEntry.findFirst({ where: { normalizedQuestion: { contains: word } } }),
        (row) => row !== null,
      );
      const before = questionsSent();

      // At the day's limit: refused before the cache is looked at, so the kept answer is not given.
      const capped = await signedIn(SYSTEM_ROLES.STUDENT, 'cache-capped');
      const { timezone } = await prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
      });
      await prisma.aiUsageDaily.create({
        data: {
          organizationId,
          userId: capped.user.id,
          day: usageDayOf(new Date(), timezone).day,
          requests: 50,
        },
      });
      const refused = await ask(
        capped.session,
        await started(capped.session, { purpose: 'workspace' }),
        question,
      );
      expect(refused.status).toBe(429);
      expect(problemCode(refused)).toBe('ai_quota_exceeded');
      expect(
        (await prisma.aiCacheEntry.findUniqueOrThrow({ where: { id: entry!.id } })).hitCount,
      ).toBe(0);

      // Within the allowance: the kept answer, and nothing called.
      const third = await signedIn(SYSTEM_ROLES.STUDENT, 'cache-third');
      const reused = await ask(
        third.session,
        await started(third.session, { purpose: 'workspace' }),
        question,
      );
      expect(reused.status).toBe(200);
      expect(questionsSent()).toBe(before);
      expect(
        (await prisma.aiCacheEntry.findUniqueOrThrow({ where: { id: entry!.id } })).hitCount,
      ).toBe(1);
    });
  });

  describe('the answer stream', () => {
    it('closes an answer with no words as failed: said safely, counted once, kept nowhere', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'empty');
      const id = await started(learner.session, { purpose: 'workspace' });
      const res = await ask(learner.session, id, '@empty What is a class?');
      expect(res.status).toBe(200);
      const events = parseEvents(res.text);
      expect(events.map((e) => e.event)).toEqual(['meta', 'error', 'usage', 'done']);
      expect(events[1]!.data).toMatchObject({ code: 'ai_unavailable' });
      expect(events.at(-1)!.data['status']).toBe('failed');
      const answer = await prisma.aiMessage.findFirstOrThrow({
        where: { conversationId: id, role: 'assistant' },
      });
      expect(answer).toMatchObject({ status: 'failed', content: '', errorCode: 'malformed' });
      const calls = await prisma.aiRequest.findMany({ where: { messageId: answer.id } });
      expect(calls.map((call) => call.outcome)).toEqual(['malformed']);
      expect(await prisma.aiCacheEntry.count({ where: { conversationId: id } })).toBe(0);
      // The next question is answered: nothing was left half-open.
      expect((await ask(learner.session, id, 'What is a class?')).status).toBe(200);
    });
  });
});

function all(status: number): Record<Role, number> {
  return { student: status, trainer: status, admin: status, superAdmin: status };
}

function superOnly(): Record<Role, number> {
  return { student: 403, trainer: 403, admin: 403, superAdmin: 200 };
}
