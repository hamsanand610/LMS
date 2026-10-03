import { Logger, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { AI_FEATURE_FLAGS, AI_MODULE_FLAG, SYSTEM_ROLES } from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { AI_PROVIDER, AiModule, AiPolicyService } from '../src/modules/ai/index.js';
import { FakeAiProvider } from '../src/modules/ai/providers/fake.provider.js';
import { GeminiAiProvider } from '../src/modules/ai/providers/gemini.provider.js';
import { ModelRouter } from '../src/modules/ai/routing/model-router.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp } from './setup/app.js';
import { eventually } from './setup/eventually.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { parseEvents } from './setup/scripted-ai.provider.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

const CANARY = 'e2e-gemini-key-CANARY-91c4';
const AI_ENV = {
  AI_PROVIDER: 'gemini',
  GEMINI_API_KEY: CANARY,
  AI_MODEL: 'gemini-3.8-flash',
  AI_FALLBACK_MODEL: 'gemini-3.5-flash-lite',
  AI_DATA_CLASSES: 'public,course',
};
const AI_FLAGS = [AI_MODULE_FLAG, ...Object.values(AI_FEATURE_FLAGS)];
const GEMINI = 'https://generativelanguage.googleapis.com/v1';

interface ProviderCall {
  url: string;
  headers: Headers;
  body: string;
}

/** Gemini's own stream for an answer: its events carry far more than SI Academy passes on. */
function geminiStream(words: string[]): Response {
  const events = words.map((word, i) => ({
    candidates: [
      {
        content: { role: 'model', parts: [{ text: word }] },
        safetyRatings: [{ category: 'HARM_CATEGORY_HARASSMENT', probability: 'NEGLIGIBLE' }],
        ...(i === words.length - 1 ? { finishReason: 'STOP' } : {}),
      },
    ],
    modelVersion: 'gemini-3.8-flash-001',
    responseId: `RESPONSE-ID-MARKER-${i}`,
    ...(i === words.length - 1
      ? { usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 5, thoughtsTokenCount: 4 } }
      : {}),
  }));
  const text = events.map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`).join('');
  return new Response(text, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

/** Gemini's whole answer, as `generateContent` gives it: a title written in the background (7D). */
function geminiAnswer(text: string): Response {
  const body = {
    candidates: [
      {
        content: { role: 'model', parts: [{ text }] },
        finishReason: 'STOP',
        safetyRatings: [{ category: 'HARM_CATEGORY_HARASSMENT', probability: 'NEGLIGIBLE' }],
      },
    ],
    usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 3 },
    modelVersion: 'gemini-3.8-flash-001',
    responseId: 'RESPONSE-ID-MARKER-TITLE',
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * SI Academy AI with Gemini configured (Phases 7B–7D) — a made-up key, and a stand-in for `fetch`
 * that answers as Gemini's API does, so nothing leaves the machine. The provider and the router are
 * built and ready; an answer goes through the real Gemini adapter and comes out as SI Academy's own
 * events; the key goes in one request header to the configured address and nowhere else — not in
 * an answer, the audit log, the logs or the API description.
 */
describe('SI Academy AI with Gemini configured (Phases 7B–7C)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let organizationId = '';
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  let counter = 0;
  const providerCalls: ProviderCall[] = [];
  const answers: string[] = [];
  const logged: unknown[][] = [];

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  async function signedIn(roleKey: string, label: string) {
    counter += 1;
    const role = await prisma.role.findFirstOrThrow({ where: { organizationId, key: roleKey } });
    const email = `ai-gemini-${label}-${counter}-${unique}@test.local`;
    await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `AI Gemini ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
      },
    });
    const session = new Session(app);
    expectStatus(await session.login(email, password), 200);
    return session;
  }

  async function setFlag(key: string, enabled: boolean) {
    expectStatus(await admin.patch(`/flags/${key}`, { enabled }), 200);
  }

  /** Every answer is kept, to look for the key in all of them. */
  function kept(res: request.Response): request.Response {
    answers.push(JSON.stringify(res.body), JSON.stringify(res.headers), res.text ?? '');
    return res;
  }

  beforeAll(async () => {
    Object.assign(process.env, AI_ENV);
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (!/googleapis\.com/.test(url)) return realFetch(input, init);
      providerCalls.push({
        url,
        headers: new Headers(init?.headers),
        body: String(init?.body ?? ''),
      });
      return url.includes(':streamGenerateContent')
        ? geminiStream(['Polymorphism ', 'lets one ', 'name do ', 'many things.'])
        : geminiAnswer('Polymorphism in brief');
    });
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
      vi.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
        logged.push(args);
      });
    }
    app = await createTestApp();
    prisma = app.get(PrismaService);
    organizationId = (
      await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.superAdmin.email } })
    ).organizationId;
    admin = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
  });
  afterAll(async () => {
    for (const key of AI_FLAGS) await setFlag(key, false);
    await app.close();
    for (const key of Object.keys(AI_ENV)) delete process.env[key];
    vi.restoreAllMocks();
  });

  it('builds Gemini and nothing else, reachable through the router alone', () => {
    expect(app.get(AI_PROVIDER)).toBeInstanceOf(GeminiAiProvider);
    // No fake in the process to fall back to.
    expect(() => app.get(FakeAiProvider, { strict: false })).toThrow();
    // The provider is not exported: no other module can call around the router.
    expect(Reflect.getMetadata('exports', AiModule)).toEqual([AiPolicyService]);
    expect(app.get(ModelRouter).serviceState()).toBe('ready');
  });

  it('tells the Super Admin the service is configured and ready, never which one or with what', async () => {
    await setFlag(AI_MODULE_FLAG, true);
    const status = kept(expectStatus(await admin.get('/ai/admin/status'), 200));
    expect(status.body).toEqual({ configured: true, gatewayReady: true, service: 'ready' });
    expect(JSON.stringify(status.body)).not.toMatch(/gemini|flash|google|key/i);
  });

  it('answers through Gemini’s adapter as SI Academy’s own events: nothing of Gemini’s reaches the browser', async () => {
    await setFlag(AI_MODULE_FLAG, true);
    await setFlag(AI_FEATURE_FLAGS.workspace, true);
    await setFlag(AI_FEATURE_FLAGS.semantic_cache, true);
    try {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'ask');
      const availability = kept(expectStatus(await learner.get('/ai/availability'), 200));
      expect(availability.body).toMatchObject({ available: true, reason: null });
      const id = (
        kept(expectStatus(await learner.post('/ai/conversations', { purpose: 'workspace' }), 201))
          .body as { id: string }
      ).id;
      const before = providerCalls.length;
      const res = kept(
        await learner.post(`/ai/conversations/${id}/messages`, {
          content: 'What is polymorphism?',
        }),
      );
      expect(res.status).toBe(200);
      const events = parseEvents(res.text);
      expect(events.map((e) => e.event)).toEqual([
        'meta',
        'delta',
        'delta',
        'delta',
        'delta',
        'usage',
        'done',
      ]);
      expect(
        events
          .filter((e) => e.event === 'delta')
          .map((e) => e.data['text'])
          .join(''),
      ).toBe('Polymorphism lets one name do many things.');
      // Thinking tokens are counted as output.
      expect(events.at(-2)!.data).toMatchObject({
        inputTokens: 30,
        outputTokens: 9,
        estimated: false,
      });
      for (const raw of [
        'candidates',
        'safetyRatings',
        'usageMetadata',
        'modelVersion',
        'RESPONSE-ID-MARKER',
        'gemini',
        'STOP',
      ]) {
        expect(res.text, raw).not.toContain(raw);
      }

      // One call, streamed, to the configured address; the key in its header and nowhere else.
      const calls = providerCalls
        .slice(before)
        .filter((call) => call.url.includes(':streamGenerateContent'));
      expect(calls).toHaveLength(1);
      expect(calls[0]!.url).toBe(`${GEMINI}/models/gemini-3.8-flash:streamGenerateContent?alt=sse`);
      expect(calls[0]!.headers.get('x-goog-api-key')).toBe(CANARY);
      expect(calls[0]!.url).not.toContain(CANARY);
      const sent = JSON.parse(calls[0]!.body) as { store: boolean; contents: unknown[] };
      expect(sent.store).toBe(false);
      expect(calls[0]!.body).not.toContain(CANARY);
      expect(calls[0]!.body).not.toContain(learner.cookie('lms_csrf') ?? 'no-cookie');

      // What the ledger kept: the provider and model, for the institute's records only.
      const ledger = await prisma.aiRequest.findFirstOrThrow({
        where: { conversationId: id, task: 'chat' },
      });
      expect(ledger).toMatchObject({
        provider: 'gemini',
        model: 'gemini-3.8-flash',
        outcome: 'ok',
      });

      // The title, written in the background through the same adapter (Phase 7D): one whole
      // answer, the key in its header alone, nothing stored by the provider, nothing of Gemini's kept.
      const titled = await eventually(
        () => prisma.aiConversation.findUniqueOrThrow({ where: { id } }),
        (row) => row.titleSource === 'model',
      );
      expect(titled.title).toBe('Polymorphism in brief');
      const title = providerCalls
        .slice(before)
        .find((call) => call.url.includes(':generateContent'));
      expect(title?.url).toBe(`${GEMINI}/models/gemini-3.8-flash:generateContent`);
      expect(title?.headers.get('x-goog-api-key')).toBe(CANARY);
      expect(JSON.parse(title!.body)).toMatchObject({ store: false });
      expect(title!.body).not.toContain(CANARY);
      expect(
        await prisma.aiRequest.findFirstOrThrow({ where: { conversationId: id, task: 'title' } }),
      ).toMatchObject({ provider: 'gemini', outcome: 'ok', countsAsQuestion: false });

      // The answer kept in the cache (Phase 7D) is SI Academy's text alone: no key, nothing raw.
      const cached = await eventually(
        () => prisma.aiCacheEntry.findFirst({ where: { normalizedQuestion: '|polymorphism' } }),
        (row) => row !== null,
      );
      expect(cached).toMatchObject({
        answer: 'Polymorphism lets one name do many things.',
        provider: 'gemini',
        model: 'gemini-3.8-flash',
        modelFamily: 'gemini-flash',
      });
      for (const raw of [CANARY, 'candidates', 'usageMetadata', 'RESPONSE-ID-MARKER', 'x-goog']) {
        expect(JSON.stringify([cached, titled]), raw).not.toContain(raw);
      }
      kept(await learner.get(`/ai/conversations/${id}`));
      kept(await learner.get('/me'));
      kept(await admin.get('/flags'));
    } finally {
      await setFlag(AI_FEATURE_FLAGS.workspace, false);
      await setFlag(AI_FEATURE_FLAGS.semantic_cache, false);
    }
  });

  it('keeps its guards: sign-in, the permission, CSRF', async () => {
    await setFlag(AI_MODULE_FLAG, true);
    expect(kept(await request(server()).get('/api/v1/ai/admin/status')).status).toBe(401);
    const administrator = await signedIn(SYSTEM_ROLES.ADMIN, 'guards');
    const refused = kept(await administrator.get('/ai/admin/status'));
    expect(refused.status).toBe(403);
    expect(problemCode(refused)).toBe('forbidden');
    const noToken = kept(
      await administrator.withoutCsrf('post', '/ai/conversations', { purpose: 'assistant' }),
    );
    expect(problemCode(noToken)).toBe('csrf_failed');
  });

  it('keeps the key out of every answer, the audit log, the logs and the API description', async () => {
    expect(answers.length).toBeGreaterThan(5);
    for (const text of answers) expect(text).not.toContain(CANARY);
    const audit = await prisma.auditLog.findMany({ where: { action: { startsWith: 'ai.' } } });
    expect(JSON.stringify(audit)).not.toContain(CANARY);
    expect(logged.length).toBeGreaterThan(0);
    expect(JSON.stringify(logged)).not.toContain(CANARY);
    const document = JSON.stringify(
      SwaggerModule.createDocument(app, new DocumentBuilder().addBearerAuth().build()),
    );
    for (const secret of [CANARY, 'x-goog-api-key', 'generativelanguage', 'GEMINI']) {
      expect(document).not.toContain(secret);
    }
  });

  it('refuses to start on a model the registry does not list', async () => {
    process.env['AI_MODEL'] = 'gemini-9-ultra';
    try {
      await expect(createTestApp()).rejects.toThrow(/AI_MODEL names "gemini-9-ultra"/);
    } finally {
      process.env['AI_MODEL'] = AI_ENV.AI_MODEL;
    }
  });
});
