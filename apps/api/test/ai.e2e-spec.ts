import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  AI_FEATURE_FLAGS,
  AI_MODULE_FLAG,
  SYSTEM_ROLES,
  type FeatureFlag,
  type MeResponse,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

const AI_FLAGS = [AI_MODULE_FLAG, ...Object.values(AI_FEATURE_FLAGS)];
const questionId = '0190a0e4-7c1d-7b9e-8f00-000000000001';

/**
 * Phase 7A: SI Academy AI's boundary. It ships switched off; every route passes the platform's
 * guards in their usual order; an option flag opens nothing without `module.ai`; a message is
 * checked against the policy (ADR-0031) and then refused as unavailable, because no provider is
 * called before conversations and usage accounting exist (Phase 7C).
 */
describe('SI Academy AI — the Phase 7A boundary', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let organizationId = '';
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  let counter = 0;

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  async function signedIn(roleKey: string, label: string) {
    counter += 1;
    const role = await prisma.role.findFirstOrThrow({ where: { organizationId, key: roleKey } });
    const email = `ai-${label}-${counter}-${unique}@test.local`;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `AI ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
      },
    });
    const session = new Session(app);
    const login = expectStatus(await session.login(email, password), 200);
    return { session, user, token: (login.body as { accessToken: string }).accessToken };
  }

  async function setFlag(key: string, enabled: boolean) {
    expectStatus(await admin.patch(`/flags/${key}`, { enabled }), 200);
  }

  const ask = (session: Session, body: object) => session.post('/ai/messages', body);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    organizationId = (
      await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.superAdmin.email } })
    ).organizationId;
    admin = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
  });
  afterAll(async () => {
    // Off again, whatever a test left: the rest of the suite runs without AI.
    for (const key of AI_FLAGS) await setFlag(key, false);
    await app.close();
  });

  it('ships switched off: the module and every surface', async () => {
    const flags = expectStatus(await admin.get('/flags'), 200).body as FeatureFlag[];
    const byKey = new Map(flags.map((flag) => [flag.key, flag]));
    expect(byKey.get(AI_MODULE_FLAG)).toMatchObject({ enabled: false, kind: 'module' });
    for (const key of Object.values(AI_FEATURE_FLAGS)) {
      expect(byKey.get(key), key).toMatchObject({ enabled: false, kind: 'option' });
    }
  });

  it('refuses every AI route while module.ai is off, for everyone', async () => {
    const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'off');
    for (const res of [
      await learner.session.get('/ai/availability'),
      await ask(learner.session, { purpose: 'assistant', content: 'What is a class?' }),
      await admin.get('/ai/admin/status'),
    ]) {
      expect(res.status).toBe(403);
      expect(problemCode(res)).toBe('module_disabled');
    }
  });

  it('keeps every AI route behind sign-in', async () => {
    const get = await request(server()).get('/api/v1/ai/availability');
    expect(get.status).toBe(401);
    const post = await request(server())
      .post('/api/v1/ai/messages')
      .send({ purpose: 'assistant', content: 'hi' });
    expect(post.status).toBe(401);
  });

  it('opens nothing through an option flag while module.ai is off', async () => {
    const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'options-only');
    for (const key of Object.values(AI_FEATURE_FLAGS)) await setFlag(key, true);
    try {
      const res = await learner.session.get('/ai/availability');
      expect(res.status).toBe(403);
      expect(problemCode(res)).toBe('module_disabled');
      const me = expectStatus(await learner.session.get('/me'), 200).body as MeResponse;
      expect(me.flags[AI_MODULE_FLAG]).toBe(false);
    } finally {
      for (const key of Object.values(AI_FEATURE_FLAGS)) await setFlag(key, false);
    }
  });

  it('grants the AI permissions as the policy says (ADR-0031)', async () => {
    const expected: [string, Record<string, string>][] = [
      [SYSTEM_ROLES.STUDENT, { 'ai:chat': 'own', 'ai:hints': 'own' }],
      [SYSTEM_ROLES.TRAINER, { 'ai:chat': 'own', 'ai:usage_read': 'batch' }],
      [SYSTEM_ROLES.ADMIN, { 'ai:chat': 'own', 'ai:usage_read': 'all' }],
      [SYSTEM_ROLES.CONTENT_MANAGER, { 'ai:chat': 'own' }],
      [SYSTEM_ROLES.PLACEMENT_COORDINATOR, { 'ai:chat': 'own' }],
    ];
    for (const [role, grants] of expected) {
      const person = await signedIn(role, `grants-${role}`);
      const me = expectStatus(await person.session.get('/me'), 200).body as MeResponse;
      const ai = Object.fromEntries(
        me.permissions.filter((p) => p.key.startsWith('ai:')).map((p) => [p.key, p.scope]),
      );
      expect(ai, role).toEqual(grants);
    }
    const superAdmin = expectStatus(await admin.get('/me'), 200).body as MeResponse;
    expect(superAdmin.permissions).toContainEqual(
      expect.objectContaining({ key: 'ai:manage', scope: 'all' }),
    );
  });

  describe('with module.ai on', () => {
    beforeAll(async () => {
      await setFlag(AI_MODULE_FLAG, true);
    });

    it('tells a person which surfaces are on, and never names the provider', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'availability');
      const off = expectStatus(await learner.session.get('/ai/availability'), 200);
      expect(off.body).toEqual({
        available: false,
        reason: 'feature_disabled',
        features: { assistant: false, workspace: false, lab_hints: false, semantic_cache: false },
      });

      await setFlag(AI_FEATURE_FLAGS.assistant, true);
      await setFlag(AI_FEATURE_FLAGS.lab_hints, true);
      try {
        const on = expectStatus(await learner.session.get('/ai/availability'), 200);
        // On for the learner, but the gateway does not answer yet (Phase 7A).
        expect(on.body).toEqual({
          available: false,
          reason: 'not_ready',
          features: { assistant: true, workspace: false, lab_hints: true, semantic_cache: false },
        });
        expect(JSON.stringify(on.body)).not.toMatch(/provider|fake|none|model|key/i);

        // A trainer holds no `ai:hints`: the lab-hint surface is not theirs, whatever the flag.
        const trainer = await signedIn(SYSTEM_ROLES.TRAINER, 'availability');
        const theirs = expectStatus(await trainer.session.get('/ai/availability'), 200);
        expect(theirs.body.features).toMatchObject({ assistant: true, lab_hints: false });
      } finally {
        await setFlag(AI_FEATURE_FLAGS.assistant, false);
        await setFlag(AI_FEATURE_FLAGS.lab_hints, false);
      }
    });

    it('checks a message against the policy, then answers unavailable: no provider is called', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'ask');
      const trainer = await signedIn(SYSTEM_ROLES.TRAINER, 'ask');
      await setFlag(AI_FEATURE_FLAGS.assistant, true);
      await setFlag(AI_FEATURE_FLAGS.lab_hints, true);
      try {
        const asked = await ask(learner.session, {
          purpose: 'assistant',
          content: 'What is a class?',
        });
        expect(asked.status).toBe(503);
        expect(problemCode(asked)).toBe('ai_unavailable');
        expect(JSON.stringify(asked.body)).not.toMatch(/provider|fake|model|key/i);

        const workspace = await ask(learner.session, { purpose: 'workspace', content: 'Hello' });
        expect(workspace.status).toBe(403);
        expect(problemCode(workspace)).toBe('ai_feature_disabled');

        const hint = { purpose: 'lab_hint', content: 'Stuck', context: { questionId } };
        expect((await ask(learner.session, hint)).status).toBe(503);
        const trainerHint = await ask(trainer.session, hint);
        expect(trainerHint.status).toBe(403);
        expect(problemCode(trainerHint)).toBe('forbidden');

        for (const invalid of [
          { purpose: 'assistant', content: '   ' },
          { purpose: 'assistant', content: 'hi', apiKey: 'sk-test' },
          { purpose: 'assistant', content: 'hi', model: 'anything' },
          { purpose: 'lab_hint', content: 'Stuck' },
        ]) {
          const res = await ask(learner.session, invalid);
          expect(res.status, JSON.stringify(invalid)).toBe(400);
          expect(problemCode(res)).toBe('validation_failed');
        }
      } finally {
        await setFlag(AI_FEATURE_FLAGS.assistant, false);
        await setFlag(AI_FEATURE_FLAGS.lab_hints, false);
      }
    });

    it('keeps CSRF and origin checks on its mutations', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'csrf');
      const body = { purpose: 'assistant', content: 'What is a class?' };
      const noToken = await learner.session.withoutCsrf('post', '/ai/messages', body);
      expect(noToken.status).toBe(403);
      expect(problemCode(noToken)).toBe('csrf_failed');
      const foreign = await request(server())
        .post('/api/v1/ai/messages')
        .set('Authorization', `Bearer ${learner.token}`)
        .set('Origin', 'https://attacker.example')
        .send(body);
      expect(foreign.status).toBe(403);
      expect(problemCode(foreign)).toBe('csrf_failed');
    });

    it('gives no AI help during a timed test', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'timed');
      const profile = await prisma.studentProfile.create({
        data: { userId: learner.user.id, studentCode: `STU-AI-${unique}`, status: 'active' },
      });
      const batch = await prisma.batch.findFirstOrThrow({
        where: { code: TEST_FIXTURES.otherBatchCode },
      });
      const test = await prisma.test.create({
        data: { organizationId, title: `AI timed ${unique}` },
      });
      await setFlag(AI_FEATURE_FLAGS.assistant, true);
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
        const during = expectStatus(await learner.session.get('/ai/availability'), 200);
        expect(during.body).toMatchObject({ available: false, reason: 'timed_assessment' });
        const refused = await ask(learner.session, { purpose: 'assistant', content: 'Answer Q3' });
        expect(refused.status).toBe(403);
        expect(problemCode(refused)).toBe('ai_not_allowed');

        // Once the attempt is handed in, the refusal ends.
        await prisma.testAttempt.update({
          where: { id: attempt.id },
          data: { status: 'submitted', submittedAt: new Date() },
        });
        const after = expectStatus(await learner.session.get('/ai/availability'), 200);
        expect(after.body.reason).not.toBe('timed_assessment');
      } finally {
        await setFlag(AI_FEATURE_FLAGS.assistant, false);
        await prisma.test.delete({ where: { id: test.id } });
      }
    });

    it('shows the gateway status to the Super Admin only, without naming the provider', async () => {
      const status = expectStatus(await admin.get('/ai/admin/status'), 200);
      expect(status.body).toEqual({ configured: false, gatewayReady: false, service: 'off' });
      for (const role of [SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.TRAINER, SYSTEM_ROLES.STUDENT]) {
        const person = await signedIn(role, `status-${role}`);
        const res = await person.session.get('/ai/admin/status');
        expect(res.status, role).toBe(403);
        expect(problemCode(res)).toBe('forbidden');
      }
    });
  });
});
