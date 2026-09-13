import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type { MeResponse } from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { createTestApp } from './setup/app.js';
import { problemCode, Session } from './setup/http.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

/** The login route allows 5 attempts per 15 minutes per IP+email; each test signs in sparingly. */
describe('authentication', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = inject('password');

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    await app.close();
  });

  it('signs in with cookies, exposes the shell data on /me and records an audit entry', async () => {
    const session = new Session(app);
    const login = await session.login(TEST_ACCOUNTS.superAdmin.email, password);
    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({
      user: { email: TEST_ACCOUNTS.superAdmin.email },
      expiresIn: 900,
    });
    expect(login.body).not.toHaveProperty('refreshToken');
    const setCookie = ([] as string[])
      .concat(login.headers['set-cookie'] as unknown as string | string[])
      .join('\n');
    expect(setCookie).toMatch(/lms_at=.*HttpOnly/);
    expect(setCookie).toMatch(/lms_rt=.*Path=\/api\/v1\/auth.*HttpOnly/);
    expect(setCookie).toMatch(/lms_csrf=/);
    expect(setCookie).not.toMatch(/lms_csrf=[^;]*;[^\n]*HttpOnly/);

    const me = await session.get('/me');
    expect(me.status).toBe(200);
    const body = me.body as MeResponse;
    expect(body.user.email).toBe(TEST_ACCOUNTS.superAdmin.email);
    expect(body.homePortal).toBe('admin');
    expect(body.roles.map((r) => r.key)).toEqual(['super_admin']);
    expect(body.permissions.some((p) => p.key === 'settings:manage' && p.scope === 'all')).toBe(
      true,
    );
    expect(body.navigation.admin.map((i) => i.key)).toEqual(
      expect.arrayContaining([
        'admin.users',
        'admin.settings.general',
        'admin.settings.branding',
        'admin.settings.roles',
      ]),
    );
    expect(body.branding.tokens.light['--brand-primary']).toMatch(/^#[0-9a-f]{6}$/i);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: TEST_ACCOUNTS.superAdmin.email },
    });
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'auth.login', actorId: user.id },
      orderBy: { occurredAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(user.lastLoginAt).not.toBeNull();
  });

  it('accepts the access token as a Bearer header without CSRF', async () => {
    const session = new Session(app);
    const login = await session.login(TEST_ACCOUNTS.admin.email, password);
    const token = (login.body as { accessToken: string }).accessToken;
    const res = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .patch('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Admin' });
    expect(res.status).toBe(204);
  });

  it('rejects cookie mutations without the CSRF header and accepts them with it', async () => {
    const session = new Session(app);
    await session.login(TEST_ACCOUNTS.trainer.email, password);
    const blocked = await session.withoutCsrf('patch', '/me', { name: 'Test Trainer' });
    expect(blocked.status).toBe(403);
    expect(problemCode(blocked)).toBe('csrf_failed');
    const allowed = await session.patch('/me', { name: 'Test Trainer' });
    expect(allowed.status).toBe(204);
  });

  it('rotates refresh tokens and revokes the family when a rotated token is replayed', async () => {
    const session = new Session(app);
    await session.login(TEST_ACCOUNTS.student.email, password);
    const firstRefreshToken = session.cookie('lms_rt')!;
    const first = await session.post('/auth/refresh');
    expect(first.status).toBe(200);
    expect(session.cookie('lms_rt')).not.toBe(firstRefreshToken);
    expect((await session.get('/me')).status).toBe(200);

    // Replaying the old token means it leaked: every session of the family is revoked.
    const replay = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/api/v1/auth/refresh')
      .set('Cookie', `lms_rt=${firstRefreshToken}; lms_csrf=${session.cookie('lms_csrf')}`)
      .set('x-csrf-token', session.cookie('lms_csrf')!);
    expect(replay.status).toBe(401);
    expect(problemCode(replay)).toBe('token_expired');
    const afterReplay = await session.post('/auth/refresh');
    expect(afterReplay.status).toBe(401);
    const reuseAudit = await prisma.auditLog.findFirst({
      where: { action: 'auth.refresh_reuse_detected' },
      orderBy: { occurredAt: 'desc' },
    });
    expect(reuseAudit).not.toBeNull();
  });

  it('ends the session on logout', async () => {
    const session = new Session(app);
    await session.login(TEST_ACCOUNTS.superAdmin.email, password);
    const logout = await session.post('/auth/logout');
    expect(logout.status).toBe(204);
    expect(session.cookie('lms_at')).toBeUndefined();
    const me = await session.get('/me');
    expect(me.status).toBe(401);
  });

  it('returns a generic error for wrong credentials and unknown accounts', async () => {
    const session = new Session(app);
    const wrong = await session.login(TEST_ACCOUNTS.admin.email, `${password}x`);
    expect(wrong.status).toBe(401);
    expect(problemCode(wrong)).toBe('invalid_credentials');
    const unknown = await session.login('nobody@test.local', password);
    expect(unknown.status).toBe(401);
    expect(problemCode(unknown)).toBe('invalid_credentials');
    expect(wrong.body.detail).toBe(unknown.body.detail);
  });

  it('locks the account after five failed attempts and throttles further tries', async () => {
    const session = new Session(app);
    for (let i = 0; i < 5; i += 1) {
      const res = await session.login(TEST_ACCOUNTS.lockout.email, 'definitely-wrong-password');
      expect(res.status).toBe(401);
    }
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: TEST_ACCOUNTS.lockout.email },
    });
    expect(user.failedLoginCount).toBe(5);
    expect(user.lockedUntil).not.toBeNull();
    expect(user.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    const failures = await prisma.auditLog.count({
      where: { action: 'auth.login_failed', resourceId: user.id },
    });
    expect(failures).toBeGreaterThanOrEqual(5);
    // The per-IP+email rate limit (5 per 15 minutes) triggers before the lock is even consulted.
    const sixth = await session.login(TEST_ACCOUNTS.lockout.email, password);
    expect(sixth.status).toBe(429);
    expect(sixth.headers['retry-after']).toBeDefined();
  });

  it('answers unauthenticated requests with a problem document', async () => {
    const res = await request(app.getHttpServer() as Parameters<typeof request>[0]).get(
      '/api/v1/me',
    );
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toMatch(/problem\+json/);
    expect(res.body).toMatchObject({ status: 401, code: 'unauthenticated' });
    expect(res.body.requestId).toBeDefined();
  });
});
