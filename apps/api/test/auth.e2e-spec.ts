import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type { MeResponse } from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { hashToken } from '../src/modules/auth/password.js';
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

    // Replaying the old token after the grace window for tabs refreshing together (Phase 6) means
    // it leaked: every session of the family is revoked.
    await prisma.session.updateMany({
      where: { refreshTokenHash: hashToken(firstRefreshToken) },
      data: { revokedAt: new Date(Date.now() - 60_000), rotatedAt: new Date(Date.now() - 60_000) },
    });
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
    // The count starts again with the lock (Phase 6).
    expect(user.failedLoginCount).toBe(0);
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

  it('answers a locked account exactly as it answers too many tries, so a lock confirms nothing', async () => {
    const lockedUntil = new Date(Date.now() + 10 * 60_000);
    await prisma.user.update({
      where: { email: TEST_ACCOUNTS.trainer.email },
      data: { lockedUntil },
    });
    try {
      const locked = await new Session(app).login(TEST_ACCOUNTS.trainer.email, password);
      expect(locked.status).toBe(429);
      expect(problemCode(locked)).toBe('rate_limited');
      expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
    } finally {
      await prisma.user.update({
        where: { email: TEST_ACCOUNTS.trainer.email },
        data: { lockedUntil: null, failedLoginCount: 0 },
      });
    }
  });

  it('tells only somebody with the right password that an account is switched off', async () => {
    await prisma.user.update({
      where: { email: TEST_ACCOUNTS.admin.email },
      data: { status: 'suspended' },
    });
    try {
      const guess = await new Session(app).login(TEST_ACCOUNTS.admin.email, `${password}-guess`);
      expect(guess.status).toBe(401);
      expect(problemCode(guess)).toBe('invalid_credentials');
      const owner = await new Session(app).login(TEST_ACCOUNTS.admin.email, password);
      expect(owner.status).toBe(401);
      expect(problemCode(owner)).toBe('account_inactive');
    } finally {
      await prisma.user.update({
        where: { email: TEST_ACCOUNTS.admin.email },
        data: { status: 'active', failedLoginCount: 0, lockedUntil: null },
      });
    }
  });

  it('throttles by the address that connected, whatever X-Forwarded-For claims', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const statuses: number[] = [];
    // The reset route allows ten tries per address; each try claims to come from somewhere new.
    for (let i = 0; i < 11; i += 1) {
      const res = await request(server)
        .post('/api/v1/auth/password/reset')
        .set('X-Forwarded-For', `198.51.100.${i + 1}`)
        .send({});
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((status) => status !== 429)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('refuses an oversized request before reading it', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    // The 413 comes from the declared length, while the 2 MB body is still on its way. Asked to
    // keep the connection, as a browser does, Node drains that body after answering; asked to close
    // it (superagent's default), Node closes the socket with the body unread, and on Windows the
    // reset that follows can discard the 413 before the client reads it (ECONNRESET).
    const res = await request(server)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .set('Connection', 'keep-alive')
      .send(JSON.stringify({ email: 'a@test.local', password: 'x'.repeat(2 * 1024 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body).toMatchObject({ code: 'payload_too_large' });
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
