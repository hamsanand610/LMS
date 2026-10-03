import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { AI_FEATURE_FLAGS, AI_MODULE_FLAG, SYSTEM_ROLES } from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { AI_PROVIDER, AiModule, AiPolicyService } from '../src/modules/ai/index.js';
import { FakeAiProvider } from '../src/modules/ai/providers/fake.provider.js';
import { GeminiAiProvider } from '../src/modules/ai/providers/gemini.provider.js';
import { ModelRouter } from '../src/modules/ai/routing/model-router.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
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

/**
 * Phase 7B with Gemini configured — a made-up key, and every request to Google refused by a
 * stand-in for `fetch`, so nothing reaches the provider. The provider and the router are built and
 * ready, the gateway still calls no provider before conversations and usage accounting (7C), and
 * the key appears in no answer and not in the API description.
 */
describe('SI Academy AI with Gemini configured (Phase 7B)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let organizationId = '';
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  let counter = 0;
  const providerCalls: string[] = [];
  const answers: string[] = [];

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
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (/googleapis\.com/.test(url) || JSON.stringify(init?.headers ?? {}).includes(CANARY)) {
        providerCalls.push(url);
        return Promise.reject(new Error('No provider call is made in the tests'));
      }
      return realFetch(input, init);
    });
    app = await createTestApp();
    prisma = app.get(PrismaService);
    organizationId = (
      await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.superAdmin.email } })
    ).organizationId;
    admin = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
  });
  afterEach(() => {
    // Not one call reached, or tried to reach, the provider.
    expect(providerCalls).toEqual([]);
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
    expect(status.body).toEqual({ configured: true, gatewayReady: false, service: 'ready' });
    expect(JSON.stringify(status.body)).not.toMatch(/gemini|flash|google|key/i);
  });

  it('still refuses a message as unavailable: no provider is called before 7C', async () => {
    await setFlag(AI_MODULE_FLAG, true);
    await setFlag(AI_FEATURE_FLAGS.assistant, true);
    try {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'ask');
      const availability = kept(expectStatus(await learner.get('/ai/availability'), 200));
      expect(availability.body).toMatchObject({ available: false, reason: 'not_ready' });
      const asked = kept(
        await learner.post('/ai/messages', { purpose: 'assistant', content: 'What is a class?' }),
      );
      expect(asked.status).toBe(503);
      expect(problemCode(asked)).toBe('ai_unavailable');
      kept(await learner.get('/me'));
      kept(await admin.get('/flags'));
    } finally {
      await setFlag(AI_FEATURE_FLAGS.assistant, false);
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
      await administrator.withoutCsrf('post', '/ai/messages', {
        purpose: 'assistant',
        content: 'Hi',
      }),
    );
    expect(problemCode(noToken)).toBe('csrf_failed');
  });

  it('keeps the key out of every answer, and out of the API description', () => {
    expect(answers.length).toBeGreaterThan(5);
    for (const text of answers) expect(text).not.toContain(CANARY);
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
