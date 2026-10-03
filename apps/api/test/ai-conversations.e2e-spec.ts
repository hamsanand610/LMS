import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  AI_FEATURE_FLAGS,
  AI_MODULE_FLAG,
  SYSTEM_ROLES,
  toLocalDateKey,
  type AiConversationDetail,
  type AiConversationSummary,
  type LearnerDataExport,
  type Paginated,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { PROMPT_VERSION } from '../src/modules/ai/policy/prompts.js';
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
};
const AI_FLAGS = [AI_MODULE_FLAG, ...Object.values(AI_FEATURE_FLAGS)];

interface Streamed {
  status: number;
  text: string;
  events: ReturnType<typeof parseEvents>;
}

/**
 * Phase 7C: SI Academy AI's conversations, end to end, with a scripted stand-in for the provider
 * (no network, no key). Ownership, the policy, the data classes, the answer stream and every way it
 * can end, the generation gate, quotas, usage, audit and privacy.
 */
describe('SI Academy AI conversations (Phase 7C)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let organizationId = '';
  let port = 0;
  const provider = new ScriptedAiProvider();
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  let counter = 0;

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  async function signedIn(roleKey: string, label: string, learnerProfile = false) {
    counter += 1;
    const role = await prisma.role.findFirstOrThrow({ where: { organizationId, key: roleKey } });
    const email = `ai7c-${label}-${counter}-${unique}@test.local`;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `AI 7C ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
        ...(learnerProfile
          ? {
              studentProfile: {
                create: { studentCode: `STU-AI7C-${counter}-${unique}`, status: 'active' },
              },
            }
          : {}),
      },
    });
    const session = new Session(app);
    const login = expectStatus(await session.login(email, password), 200);
    return { session, user, email, token: (login.body as { accessToken: string }).accessToken };
  }

  async function setFlag(key: string, enabled: boolean) {
    expectStatus(await admin.patch(`/flags/${key}`, { enabled }), 200);
  }

  async function conversation(session: Session, body: object = { purpose: 'workspace' }) {
    return (
      expectStatus(await session.post('/ai/conversations', body), 201).body as AiConversationSummary
    ).id;
  }

  async function ask(session: Session, id: string, content: string): Promise<Streamed> {
    const res = await session.post(`/ai/conversations/${id}/messages`, { content });
    return {
      status: res.status,
      text: res.text ?? '',
      events: res.status === 200 ? parseEvents(res.text) : [],
    };
  }

  /** A question over a raw connection, to read the stream as it comes and to leave mid-answer. */
  function askRaw(token: string, id: string, content: string, leaveAfterFirstDelta = false) {
    return new Promise<Streamed>((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          method: 'POST',
          path: `/api/v1/ai/conversations/${id}/messages`,
          agent: false,
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        },
        (res) => {
          let text = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => {
            text += chunk;
            if (leaveAfterFirstDelta && text.includes('event: delta')) {
              req.destroy();
              resolve({ status: res.statusCode ?? 0, text, events: parseEvents(text) });
            }
          });
          res.on('end', () =>
            resolve({ status: res.statusCode ?? 0, text, events: parseEvents(text) }),
          );
        },
      );
      req.on('error', (error) => (leaveAfterFirstDelta ? undefined : reject(error)));
      req.end(JSON.stringify({ content }));
    });
  }

  const answerText = (streamed: Streamed) =>
    streamed.events
      .filter((e) => e.event === 'delta')
      .map((e) => e.data['text'])
      .join('');

  async function messagesOf(conversationId: string) {
    return prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'asc' }, { role: 'asc' }],
    });
  }

  /** The conversation once its title is the model's (Phase 7D): written in the background. */
  function titled(conversationId: string) {
    return eventually(
      () => prisma.aiConversation.findUniqueOrThrow({ where: { id: conversationId } }),
      (row) => row.titleSource === 'model',
    );
  }

  /** What was asked of the provider for questions — not titles or notes, written in the background. */
  const questionsSent = (scripted: ScriptedAiProvider = provider) =>
    scripted.requests.filter((r) => r.task === 'chat' || r.task === 'hint');
  /** Whether any request at all — a question, a title, notes — carried this text. */
  const everSent = (text: string) => JSON.stringify(provider.requests).includes(text);

  /** A lab in the practice catalogue, with hidden material that must never reach the provider. */
  async function liveLab() {
    const question = await prisma.question.create({
      data: {
        organizationId,
        slug: `ai7c-lab-${unique}-${counter++}`,
        title: 'Sum two numbers',
        body: 'Read two integers and print their sum.',
        type: 'coding',
        status: 'published',
        inPractice: true,
        validation: { ok: true },
      },
    });
    await prisma.codingProblem.create({
      data: {
        questionId: question.id,
        languages: ['python'],
        referenceSolution: { python: 'print(REFERENCE-SOLUTION-MARKER)' },
        testCases: {
          create: [
            { input: '1 2', expectedOutput: '3', isSample: true, position: 0 },
            { input: 'HIDDEN-CASE-MARKER', expectedOutput: 'HIDDEN-OUTPUT-MARKER', position: 1 },
          ],
        },
      },
    });
    return question.id;
  }

  beforeAll(async () => {
    Object.assign(process.env, AI_ENV);
    app = await createTestApp({ aiProvider: provider });
    prisma = app.get(PrismaService);
    organizationId = (
      await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.superAdmin.email } })
    ).organizationId;
    admin = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    for (const key of AI_FLAGS) await setFlag(key, true);
    const listening = app.getHttpServer() as http.Server;
    await new Promise<void>((resolve) => listening.listen(0, '127.0.0.1', resolve));
    port = (listening.address() as AddressInfo).port;
  });
  afterAll(async () => {
    for (const key of AI_FLAGS) await setFlag(key, false);
    const listening = app.getHttpServer() as http.Server;
    listening.closeAllConnections();
    await app.close();
    for (const key of Object.keys(AI_ENV)) delete process.env[key];
  });

  describe('conversations are their owner’s alone', () => {
    it('are started, listed, read and deleted by their owner, and each is audited', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'owner');
      const created = expectStatus(
        await learner.session.post('/ai/conversations', { purpose: 'workspace' }),
        201,
      ).body as AiConversationSummary;
      expect(created).toEqual({
        id: expect.any(String),
        purpose: 'workspace',
        title: '',
        status: 'active',
        createdAt: expect.any(String),
        lastMessageAt: null,
      });
      const list = expectStatus(await learner.session.get('/ai/conversations'), 200)
        .body as Paginated<AiConversationSummary>;
      expect(list.data.map((c) => c.id)).toEqual([created.id]);
      const detail = expectStatus(await learner.session.get(`/ai/conversations/${created.id}`), 200)
        .body as AiConversationDetail;
      expect(detail.messages).toEqual([]);

      expectStatus(await learner.session.delete(`/ai/conversations/${created.id}`), 204);
      expectStatus(await learner.session.get(`/ai/conversations/${created.id}`), 404);
      const after = expectStatus(await learner.session.get('/ai/conversations'), 200)
        .body as Paginated<AiConversationSummary>;
      expect(after.data).toEqual([]);
      // Deleted is gone for good: no question can be asked in it either.
      expect((await ask(learner.session, created.id, 'Still there?')).status).toBe(404);

      const actions = (
        await prisma.auditLog.findMany({
          where: { resourceId: created.id },
          orderBy: { occurredAt: 'asc' },
        })
      ).map((entry) => entry.action);
      expect(actions).toEqual(['ai.conversation.created', 'ai.conversation.deleted']);
    });

    it('are not found by anybody else — another learner, a trainer, an administrator, the Super Admin', async () => {
      const owner = await signedIn(SYSTEM_ROLES.STUDENT, 'private');
      const id = await conversation(owner.session);
      expect((await ask(owner.session, id, 'My private question')).status).toBe(200);
      const others = [
        (await signedIn(SYSTEM_ROLES.STUDENT, 'other')).session,
        (await signedIn(SYSTEM_ROLES.TRAINER, 'other')).session,
        (await signedIn(SYSTEM_ROLES.ADMIN, 'other')).session,
        admin,
      ];
      for (const other of others) {
        for (const res of [
          await other.get(`/ai/conversations/${id}`),
          await other.delete(`/ai/conversations/${id}`),
          await other.post(`/ai/conversations/${id}/messages`, { content: 'Peek' }),
        ]) {
          expect(res.status).toBe(404);
          expect(JSON.stringify(res.body)).not.toContain('private question');
        }
        const list = expectStatus(await other.get('/ai/conversations'), 200)
          .body as Paginated<AiConversationSummary>;
        expect(list.data.map((c) => c.id)).not.toContain(id);
      }
      expect((await messagesOf(id)).filter((m) => m.role === 'user')).toHaveLength(1);
    });

    it('keep the platform’s guards: sign-in, the permission, the module and the surface', async () => {
      for (const res of [
        await request(server()).get('/api/v1/ai/conversations'),
        await request(server()).post('/api/v1/ai/conversations').send({ purpose: 'workspace' }),
      ]) {
        expect(res.status).toBe(401);
      }
      // A role without AI permissions.
      const role = await prisma.role.create({
        data: { organizationId, key: `no_ai_${unique}`, name: `No AI ${unique}` },
      });
      counter += 1;
      const email = `ai7c-noai-${counter}-${unique}@test.local`;
      await prisma.user.create({
        data: {
          organizationId,
          email,
          name: 'No AI',
          passwordHash: await hashPassword(password),
          status: 'active',
          emailVerifiedAt: new Date(),
          roles: { create: [{ roleId: role.id }] },
        },
      });
      const outsider = new Session(app);
      expectStatus(await outsider.login(email, password), 200);
      expect(problemCode(await outsider.get('/ai/conversations'))).toBe('forbidden');
      // A trainer has no `ai:hints`: lab hints are not theirs.
      const trainer = await signedIn(SYSTEM_ROLES.TRAINER, 'hints');
      const lab = await liveLab();
      const hint = await trainer.session.post('/ai/conversations', {
        purpose: 'lab_hint',
        context: { questionId: lab },
      });
      expect(problemCode(hint)).toBe('forbidden');

      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'switches');
      const id = await conversation(learner.session);
      await setFlag(AI_FEATURE_FLAGS.workspace, false);
      try {
        const off = await learner.session.post(`/ai/conversations/${id}/messages`, {
          content: 'Hi',
        });
        expect(off.status).toBe(403);
        expect(problemCode(off)).toBe('ai_feature_disabled');
      } finally {
        await setFlag(AI_FEATURE_FLAGS.workspace, true);
      }
      await setFlag(AI_MODULE_FLAG, false);
      try {
        expect(problemCode(await learner.session.get('/ai/conversations'))).toBe('module_disabled');
      } finally {
        await setFlag(AI_MODULE_FLAG, true);
      }
      const csrf = await learner.session.withoutCsrf('post', `/ai/conversations/${id}/messages`, {
        content: 'Hi',
      });
      expect(problemCode(csrf)).toBe('csrf_failed');
      expect(provider.requests.some((r) => r.messages.at(-1)?.content === 'Hi')).toBe(false);
    });

    it('take a lab hint only about a lab the learner can reach, and no course or lesson yet', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'subjects');
      const lab = await liveLab();
      expectStatus(
        await learner.session.post('/ai/conversations', {
          purpose: 'lab_hint',
          context: { questionId: lab },
        }),
        201,
      );
      const hidden = await prisma.question.create({
        data: {
          organizationId,
          slug: `ai7c-draft-${unique}`,
          title: 'Not published',
          body: 'Draft',
          type: 'coding',
          status: 'draft',
        },
      });
      const unreachable = await learner.session.post('/ai/conversations', {
        purpose: 'lab_hint',
        context: { questionId: hidden.id },
      });
      expect(unreachable.status).toBe(404);
      // Refused whichever course it names: that context arrives with the on-page assistant (7E).
      const course = { id: '0190a0e4-7c1d-7b9e-8f00-0000000000c1' };
      const about = await learner.session.post('/ai/conversations', {
        purpose: 'assistant',
        context: { courseId: course.id },
      });
      expect(about.status).toBe(422);
      expect(problemCode(about)).toBe('ai_subject_not_supported');
    });
  });

  describe('the policy, before anything is sent', () => {
    it('gives no AI help during a timed test, at the message endpoint itself', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'timed', true);
      const id = await conversation(learner.session);
      const profile = await prisma.studentProfile.findUniqueOrThrow({
        where: { userId: learner.user.id },
      });
      const batch = await prisma.batch.findFirstOrThrow({
        where: { code: TEST_FIXTURES.otherBatchCode },
      });
      const test = await prisma.test.create({
        data: { organizationId, title: `AI 7C timed ${unique}` },
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
        const attempt = await prisma.testAttempt.create({
          data: {
            testId: test.id,
            scheduleId: schedule.id,
            studentId: profile.id,
            expiresAt: new Date(Date.now() + 1_800_000),
          },
        });
        const before = questionsSent().length;
        for (const res of [
          await learner.session.post(`/ai/conversations/${id}/messages`, { content: 'Answer Q3' }),
          await learner.session.post('/ai/conversations', { purpose: 'workspace' }),
          await learner.session.get(`/ai/conversations/${id}`),
          await learner.session.get('/ai/conversations'),
        ]) {
          expect(res.status).toBe(403);
          expect(problemCode(res)).toBe('ai_not_allowed');
        }
        expect(questionsSent().length).toBe(before);
        expect(everSent('Answer Q3')).toBe(false);
        expect(await messagesOf(id)).toEqual([]);
        expect(
          await prisma.auditLog.count({
            where: {
              action: 'ai.policy.refused',
              resourceId: id,
              after: { path: ['reason'], equals: 'timed_assessment' },
            },
          }),
        ).toBe(1);

        await prisma.testAttempt.update({
          where: { id: attempt.id },
          data: { status: 'submitted', submittedAt: new Date() },
        });
        expect((await ask(learner.session, id, 'Now?')).status).toBe(200);
      } finally {
        await prisma.test.delete({ where: { id: test.id } });
      }
    });

    it('never sends a credential anywhere: the message is refused, not stored, and the refusal audited', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'secret');
      const id = await conversation(learner.session);
      const key = `AIza${'Q'.repeat(35)}`;
      const before = questionsSent().length;
      const refused = await learner.session.post(`/ai/conversations/${id}/messages`, {
        content: `Why does ${key} not work?`,
      });
      expect(refused.status).toBe(422);
      expect(problemCode(refused)).toBe('ai_restricted_content');
      expect(questionsSent().length).toBe(before);
      expect(everSent(key)).toBe(false);
      expect(await messagesOf(id)).toEqual([]);
      const entry = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'ai.policy.refused', resourceId: id },
      });
      expect(entry.after).toMatchObject({ reason: 'restricted_content', dataClass: 'restricted' });
      expect(JSON.stringify(entry)).not.toContain(key);
    });

    it('refuses the learner’s own work while only public data is approved, and sends nothing', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'personal');
      const lab = await liveLab();
      const id = await conversation(learner.session, {
        purpose: 'lab_hint',
        context: { questionId: lab },
      });
      const before = questionsSent().length;
      const refused = await learner.session.post(`/ai/conversations/${id}/messages`, {
        content: 'Why does my loop never end?',
      });
      expect(refused.status).toBe(403);
      expect(problemCode(refused)).toBe('ai_data_not_approved');
      expect(questionsSent().length).toBe(before);
      expect(everSent('Why does my loop never end?')).toBe(false);
      expect(await messagesOf(id)).toEqual([]);
    });
  });

  describe('the answer stream', () => {
    it('streams meta, the answer, usage and done, in order, and keeps question and answer', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'stream');
      const id = await conversation(learner.session);
      const res = await learner.session.post(`/ai/conversations/${id}/messages`, {
        content: 'What is a class?',
      });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/event-stream; charset=utf-8');
      expect(res.headers['cache-control']).toBe('no-store, no-transform');
      const events = parseEvents(res.text);
      const names = events.map((e) => e.event);
      expect(names[0]).toBe('meta');
      expect(names.at(-1)).toBe('done');
      expect(names.at(-2)).toBe('usage');
      expect(names.slice(1, -2).every((name) => name === 'delta')).toBe(true);
      const meta = events[0]!.data;
      expect(meta['conversationId']).toBe(id);
      expect(answerText({ status: 200, text: res.text, events })).toBe(
        'Scripted answer to: What is a class?',
      );
      expect(events.at(-1)!.data).toEqual({
        messageId: meta['assistantMessageId'],
        status: 'complete',
      });
      const words = 'Scripted answer to: What is a class?'.split(/(?<= )/).length;
      expect(events.at(-2)!.data).toEqual({
        inputTokens: 40,
        outputTokens: words,
        estimated: false,
        requestsLeftToday: 49,
        tokensLeftToday: 100_000 - 40 - words,
      });

      // The title is the question's first line at once, then the model's, in the background (7D).
      expect((await titled(id)).title).toBe('What is a');
      const detail = expectStatus(await learner.session.get(`/ai/conversations/${id}`), 200)
        .body as AiConversationDetail;
      expect(detail.title).toBe('What is a');
      expect(detail.messages.map((m) => [m.role, m.status, m.content])).toEqual([
        ['user', 'complete', 'What is a class?'],
        ['assistant', 'complete', 'Scripted answer to: What is a class?'],
      ]);
      // Provenance and usage are kept with the answer, and never shown to the browser.
      const answer = await prisma.aiMessage.findUniqueOrThrow({
        where: { id: meta['assistantMessageId'] as string },
      });
      expect(answer).toMatchObject({
        provider: 'fake',
        model: 'fake-1',
        promptVersion: PROMPT_VERSION,
        dataClass: 'public',
        inputTokens: 40,
        outputTokens: words,
        finishReason: 'stop',
        errorCode: null,
      });
      expect(JSON.stringify(detail)).not.toMatch(/fake|provider|model|promptVersion/i);
      expect(res.text).not.toMatch(/fake-1|"provider"|"model"/);
    });

    it('records each answered question once: one call in the ledger, one question in the day', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'ledger');
      const id = await conversation(learner.session);
      const streamed = await ask(learner.session, id, 'Count me once');
      const messageId = streamed.events[0]!.data['assistantMessageId'] as string;
      const calls = await prisma.aiRequest.findMany({ where: { messageId } });
      const words = 'Scripted answer to: Count me once'.split(/(?<= )/).length;
      expect(calls).toEqual([
        expect.objectContaining({
          userId: learner.user.id,
          conversationId: id,
          feature: 'workspace',
          task: 'chat',
          dataClass: 'public',
          provider: 'fake',
          model: 'fake-1',
          outcome: 'ok',
          inputTokens: 40,
          outputTokens: words,
          totalTokens: 40 + words,
          tokensEstimated: false,
          // AI_MODEL_COSTS fake-1=1/2: a million tokens cost $1 in and $2 out, so a token is a
          // millionth of a dollar in and two out.
          estimatedCostMicros: 40 + 2 * words,
        }),
      ]);
      const { timezone } = await prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
      });
      const day = new Date(`${toLocalDateKey(new Date(), timezone)}T00:00:00.000Z`);
      // The title written in the background (Phase 7D) adds its tokens and cost to the day, never
      // a question: 5 tokens in and 3 out, at $1 and $2 a million.
      await titled(id);
      expect(
        await prisma.aiUsageDaily.findUniqueOrThrow({
          where: { userId_day: { userId: learner.user.id, day } },
        }),
      ).toMatchObject({
        requests: 1,
        inputTokens: 40 + 5,
        outputTokens: words + 3,
        totalTokens: 40 + words + 8,
        estimatedCostMicros: 40 + 2 * words + 5 + 2 * 3,
      });
    });

    it('sends the recent conversation and the question — never another learner’s, a hidden case or a solution', async () => {
      const other = await signedIn(SYSTEM_ROLES.STUDENT, 'other-private');
      const otherId = await conversation(other.session);
      await ask(other.session, otherId, 'OTHER-LEARNER-MARKER question');
      await liveLab();

      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'context');
      const id = await conversation(learner.session);
      await ask(learner.session, id, 'First question');
      await ask(learner.session, id, 'Second question');
      const sent = questionsSent().at(-1)!;
      expect(sent.messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
      expect(sent.messages.slice(1).map((m) => m.content)).toEqual([
        'First question',
        'Scripted answer to: First question',
        'Second question',
      ]);
      const everything = JSON.stringify(questionsSent().slice(-2));
      for (const marker of [
        'OTHER-LEARNER-MARKER',
        'HIDDEN-CASE-MARKER',
        'HIDDEN-OUTPUT-MARKER',
        'REFERENCE-SOLUTION-MARKER',
        learner.email,
        learner.user.id,
      ]) {
        expect(everything).not.toContain(marker);
      }
    });

    it('says how an answer ended — cut short, withheld, failed, unreadable, too slow — and keeps no partial answer', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'endings');
      const id = await conversation(learner.session);
      const cases: [string, string, string | null, string][] = [
        ['@length Explain loops', 'complete', null, 'notice:answer_cut_short'],
        ['@blocked Explain loops', 'blocked', 'ai_answer_withheld', 'blocked'],
        ['@fail Explain loops', 'failed', 'ai_unavailable', 'unavailable'],
        ['@failmid Explain loops', 'failed', 'ai_unavailable', 'unavailable'],
        ['@malformed Explain loops', 'failed', 'ai_unavailable', 'malformed'],
        ['@hang Explain loops', 'failed', 'ai_timeout', 'timeout'],
      ];
      for (const [question, status, errorCode, stored] of cases) {
        const streamed = await ask(learner.session, id, question);
        expect(streamed.status, question).toBe(200);
        const names = streamed.events.map((e) => e.event);
        expect(names[0], question).toBe('meta');
        expect(streamed.events.at(-1)!.data['status'], question).toBe(status);
        if (errorCode) {
          expect(streamed.events.find((e) => e.event === 'error')?.data['code'], question).toBe(
            errorCode,
          );
        } else {
          expect(names, question).toContain('notice');
        }
        // Nothing of the provider's own failure travels: no status, reason or model.
        expect(streamed.text, question).not.toMatch(/503|httpStatus|NOT_JSON|fake-1|diagnostic/);
        const answer = await prisma.aiMessage.findUniqueOrThrow({
          where: { id: streamed.events[0]!.data['assistantMessageId'] as string },
        });
        expect(answer.status, question).toBe(status);
        if (status !== 'complete') {
          // A partial answer is never kept as if it were one.
          expect(answer.content, question).toBe('');
          expect(answer.errorCode, question).toBe(stored);
        }
      }
      // An answer that stopped while writing is counted with estimated tokens, marked so.
      const hung = await prisma.aiRequest.findFirstOrThrow({
        where: { conversationId: id, outcome: 'timeout' },
      });
      expect(hung).toMatchObject({ tokensEstimated: true });
      expect(hung.outputTokens).toBeGreaterThan(0);
      // A provider failure is audited, as metadata only.
      const failures = await prisma.auditLog.findMany({
        where: { action: 'ai.generation.failed', resourceId: id },
      });
      expect(failures.map((f) => (f.after as { kind: string }).kind).sort()).toEqual(
        ['malformed', 'timeout', 'unavailable', 'unavailable'].sort(),
      );
      expect(JSON.stringify(failures)).not.toContain('Explain loops');
      // Through all of it the gate opened again each time.
      expect(
        (await ask(learner.session, id, 'Still answering?')).events.at(-1)!.data['status'],
      ).toBe('complete');
    });

    it('stops when the reader leaves mid-answer, and closes the answer as cancelled', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'leave');
      const id = await conversation(learner.session);
      const partial = await askRaw(
        learner.token,
        id,
        '@slow Tell me about recursion in Java please',
        true,
      );
      expect(partial.events.some((e) => e.event === 'delta')).toBe(true);
      const answerId = partial.events[0]!.data['assistantMessageId'] as string;
      const closed = await eventually(
        () => prisma.aiMessage.findUniqueOrThrow({ where: { id: answerId } }),
        (message) => message.status !== 'streaming',
      );
      expect(closed).toMatchObject({ status: 'cancelled', content: '', errorCode: 'cancelled' });
      const call = await prisma.aiRequest.findFirstOrThrow({ where: { messageId: answerId } });
      expect(call).toMatchObject({ outcome: 'cancelled', tokensEstimated: true });
      // Leaving is not a provider failure: nothing audited as one.
      expect(
        await prisma.auditLog.count({ where: { action: 'ai.generation.failed', resourceId: id } }),
      ).toBe(0);
      // And the gate is open again.
      expect((await ask(learner.session, id, 'Next')).events.at(-1)!.data['status']).toBe(
        'complete',
      );
    });
  });

  describe('one answer at a time per person', () => {
    it('refuses a second question while one is being answered, stores nothing for it, and opens again after', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'gate');
      const first = await conversation(learner.session);
      const second = await conversation(learner.session);
      const running = askRaw(
        learner.token,
        first,
        '@slow one two three four five six seven eight nine ten',
      );
      await eventually(
        () => prisma.aiMessage.count({ where: { userId: learner.user.id, status: 'streaming' } }),
        (count) => count === 1,
      );
      const refused = await learner.session.post(`/ai/conversations/${second}/messages`, {
        content: 'Me too',
      });
      expect(refused.status).toBe(409);
      expect(problemCode(refused)).toBe('ai_generation_in_progress');
      expect(await messagesOf(second)).toEqual([]);
      expect(
        await prisma.auditLog.count({
          where: { action: 'ai.generation.busy', resourceId: second },
        }),
      ).toBe(1);

      const done = await running;
      expect(done.events.at(-1)!.data['status']).toBe('complete');
      expect((await ask(learner.session, second, 'Me too')).events.at(-1)!.data['status']).toBe(
        'complete',
      );
    });

    it('closes an answer a stopped process left behind, and lets the next question through', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'abandoned');
      const id = await conversation(learner.session);
      const abandoned = await prisma.aiMessage.create({
        data: {
          conversationId: id,
          userId: learner.user.id,
          role: 'assistant',
          status: 'streaming',
          createdAt: new Date(Date.now() - 10 * 60_000),
        },
      });
      expect((await ask(learner.session, id, 'Hello again')).events.at(-1)!.data['status']).toBe(
        'complete',
      );
      expect(
        await prisma.aiMessage.findUniqueOrThrow({ where: { id: abandoned.id } }),
      ).toMatchObject({
        status: 'failed',
        errorCode: 'interrupted',
      });
    });
  });

  describe('quotas', () => {
    async function usedUp(userId: string, data: { requests?: number; totalTokens?: number }) {
      const { timezone } = await prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
      });
      const day = new Date(`${toLocalDateKey(new Date(), timezone)}T00:00:00.000Z`);
      await prisma.aiUsageDaily.create({ data: { organizationId, userId, day, ...data } });
    }

    it('refuses a question over the daily allowance before calling anything, and says so', async () => {
      for (const [label, usage] of [
        ['requests', { requests: 50 }],
        ['tokens', { totalTokens: 100_000 }],
      ] as const) {
        const learner = await signedIn(SYSTEM_ROLES.STUDENT, `quota-${label}`);
        const id = await conversation(learner.session);
        await usedUp(learner.user.id, usage);
        const before = questionsSent().length;
        const refused = await learner.session.post(`/ai/conversations/${id}/messages`, {
          content: 'One more',
        });
        expect(refused.status, label).toBe(429);
        expect(problemCode(refused), label).toBe('ai_quota_exceeded');
        expect(questionsSent().length, label).toBe(before);
        expect(everSent('One more'), label).toBe(false);
        expect(await messagesOf(id), label).toEqual([]);
        const entry = await prisma.auditLog.findFirstOrThrow({
          where: { action: 'ai.quota.exceeded', resourceId: id },
        });
        expect(entry.after, label).toEqual({ limit: label });
      }
    });
  });

  describe('privacy (ADM-11)', () => {
    it('hands a learner their AI data, and erases it — keeping the institute’s counts, belonging to nobody', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'privacy', true);
      const id = await conversation(learner.session);
      await ask(learner.session, id, 'PRIVACY-MARKER question');
      const deleted = await conversation(learner.session);
      await ask(learner.session, deleted, 'Deleted but held');
      // Both titles are written (Phase 7D) before the deletion and the export.
      await titled(id);
      await titled(deleted);
      expectStatus(await learner.session.delete(`/ai/conversations/${deleted}`), 204);

      const exported = expectStatus(
        await admin.post(`/users/${learner.user.id}/privacy/export`),
        200,
      ).body as { data: LearnerDataExport };
      const ai = exported.data.ai;
      expect(ai.conversations).toHaveLength(2);
      expect(ai.conversations[0]!.messages.map((m) => m.content)).toEqual([
        'PRIVACY-MARKER question',
        'Scripted answer to: PRIVACY-MARKER question',
      ]);
      expect(ai.conversations[1]!.deletedAt).not.toBeNull();
      // Two questions' calls, and the two titles' (Phase 7D); the day counts the questions.
      expect(ai.requests.filter((r) => r.task === 'chat')).toHaveLength(2);
      expect(ai.requests.filter((r) => r.task === 'title')).toHaveLength(2);
      expect(ai.usage).toEqual([expect.objectContaining({ requests: 2 })]);
      expect(JSON.stringify(ai)).not.toMatch(/fake|provider|model/i);

      expectStatus(
        await admin.post(`/users/${learner.user.id}/privacy/erase`, {
          confirmEmail: learner.email,
          reason: 'At the learner’s request',
        }),
        200,
      );
      expect(await prisma.aiConversation.count({ where: { userId: learner.user.id } })).toBe(0);
      expect(
        await prisma.aiMessage.count({ where: { conversationId: { in: [id, deleted] } } }),
      ).toBe(0);
      expect(await prisma.aiRequest.count({ where: { userId: learner.user.id } })).toBe(0);
      expect(await prisma.aiUsageDaily.count({ where: { userId: learner.user.id } })).toBe(0);
      // The calls and the day's totals stay, belonging to nobody.
      const kept = await prisma.aiRequest.findMany({
        where: { userId: null, conversationId: null, organizationId, task: 'chat', outcome: 'ok' },
      });
      expect(kept.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('the audit trail', () => {
    it('records what governance needs and never a question or an answer', async () => {
      const entries = await prisma.auditLog.findMany({ where: { action: { startsWith: 'ai.' } } });
      const actions = new Set(entries.map((entry) => entry.action));
      for (const action of [
        'ai.conversation.created',
        'ai.conversation.deleted',
        'ai.policy.refused',
        'ai.quota.exceeded',
        'ai.generation.busy',
        'ai.generation.failed',
      ]) {
        expect(actions, action).toContain(action);
      }
      const text = JSON.stringify(entries);
      for (const said of [
        'What is a class?',
        'Scripted answer',
        'PRIVACY-MARKER',
        'Explain loops',
        'AIza',
      ]) {
        expect(text).not.toContain(said);
      }
    });
  });

  describe('with the learner’s own work approved (AI_DATA_CLASSES=public,personal)', () => {
    let approved: INestApplication;
    const second = new ScriptedAiProvider();

    beforeAll(async () => {
      process.env['AI_DATA_CLASSES'] = 'public,personal';
      approved = await createTestApp({ aiProvider: second });
    });
    afterAll(async () => {
      delete process.env['AI_DATA_CLASSES'];
      await approved.close();
    });

    it('answers a lab hint, sending none of the lab’s hidden cases or its solution', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'hint');
      const session = new Session(approved);
      expectStatus(await session.login(learner.email, password), 200);
      const lab = await liveLab();
      const id = (
        expectStatus(
          await session.post('/ai/conversations', {
            purpose: 'lab_hint',
            context: { questionId: lab },
          }),
          201,
        ).body as AiConversationSummary
      ).id;
      const res = await session.post(`/ai/conversations/${id}/messages`, {
        content: 'Why does my sum print nothing?',
      });
      expect(res.status).toBe(200);
      expect(parseEvents(res.text).at(-1)!.data['status']).toBe('complete');
      const sent = questionsSent(second).at(-1)!;
      expect(sent.task).toBe('hint');
      expect(sent.messages[0]!.content).toContain('Never give the complete solution');
      const everything = JSON.stringify(sent);
      for (const marker of [
        'HIDDEN-CASE-MARKER',
        'HIDDEN-OUTPUT-MARKER',
        'REFERENCE-SOLUTION-MARKER',
      ]) {
        expect(everything).not.toContain(marker);
      }
      expect(
        await prisma.aiMessage.findFirstOrThrow({
          where: { conversationId: id, role: 'assistant' },
        }),
      ).toMatchObject({ dataClass: 'personal', policyFlags: ['own_work'] });
    });
  });
});
