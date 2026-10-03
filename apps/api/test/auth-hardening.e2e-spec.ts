import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { SYSTEM_ROLES } from '@lms/shared';
import { AuthContextService } from '../src/core/auth/auth-context.service.js';
import { EmailService } from '../src/core/email/email.service.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { generateOpaqueToken, hashPassword, hashToken } from '../src/modules/auth/password.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

/**
 * Phase 6: sessions end when they are ended — the access token in hand included — a sign-in is
 * remembered only when asked, and an invitation or reset link opens only the account it was meant
 * for, in the state it was meant for. Each test works on accounts of its own.
 */
describe('authentication hardening', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authContext: AuthContextService;
  let admin: Session;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  let organizationId = '';
  let counter = 0;

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  async function account(
    label: string,
    status: 'active' | 'invited' | 'suspended' | 'deactivated' = 'active',
    roleKey: string = SYSTEM_ROLES.STUDENT,
  ): Promise<{ id: string; email: string }> {
    counter += 1;
    const role = await prisma.role.findFirstOrThrow({ where: { organizationId, key: roleKey } });
    const email = `harden-${label}-${counter}-${unique}@test.local`;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `Hardening ${label}`,
        passwordHash: status === 'invited' ? null : await hashPassword(password),
        status,
        emailVerifiedAt: status === 'invited' ? null : new Date(),
        roles: { create: [{ roleId: role.id }] },
      },
    });
    return { id: user.id, email };
  }

  async function signIn(email: string, rememberMe = false) {
    const session = new Session(app);
    const res = expectStatus(await session.login(email, password, rememberMe), 200);
    return { session, token: (res.body as { accessToken: string }).accessToken, res };
  }

  const bearer = (token: string) =>
    request(server()).get('/api/v1/me').set('Authorization', `Bearer ${token}`);

  function refreshWith(refreshToken: string) {
    return request(server()).post('/api/v1/auth/refresh').set('Cookie', `lms_rt=${refreshToken}`);
  }

  function refreshCookie(res: request.Response): string {
    const header = ([] as string[]).concat(res.headers['set-cookie'] as unknown as string[]);
    return header.find((c) => c.startsWith('lms_rt=')) ?? '';
  }

  async function invitationFor(userId: string): Promise<string> {
    const token = generateOpaqueToken();
    await prisma.invitation.create({
      data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3_600_000) },
    });
    return token;
  }

  async function resetLinkFor(userId: string): Promise<string> {
    const token = generateOpaqueToken();
    await prisma.passwordReset.create({
      data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 1_800_000) },
    });
    return token;
  }

  const accept = (token: string, newPassword = `Accepted-${unique}-pass`) =>
    request(server())
      .post(`/api/v1/auth/invitations/${token}/accept`)
      .send({ password: newPassword, consents: { terms: true, privacy: true } });

  const reset = (token: string, newPassword = `Reset-${unique}-password`) =>
    request(server()).post('/api/v1/auth/password/reset').send({ token, password: newPassword });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    authContext = app.get(AuthContextService);
    organizationId = (
      await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.superAdmin.email } })
    ).organizationId;
    admin = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
  });
  afterAll(async () => {
    await app.close();
  });

  describe('sessions', () => {
    it('remembers a sign-in across browser restarts only when asked, through every refresh', async () => {
      const learner = await account('remember');
      const brief = await signIn(learner.email, false);
      expect(refreshCookie(brief.res)).not.toMatch(/Max-Age|Expires/i);
      const rotated = expectStatus(await brief.session.post('/auth/refresh'), 200);
      // A refresh must not turn a browser-session sign-in into a remembered one.
      expect(refreshCookie(rotated)).toMatch(/^lms_rt=/);
      expect(refreshCookie(rotated)).not.toMatch(/Max-Age|Expires/i);

      const kept = await signIn(learner.email, true);
      expect(refreshCookie(kept.res)).toMatch(/Max-Age=\d+/i);
      const keptRotated = expectStatus(await kept.session.post('/auth/refresh'), 200);
      expect(refreshCookie(keptRotated)).toMatch(/Max-Age=\d+/i);

      const rows = await prisma.session.findMany({
        where: { userId: learner.id, revokedAt: null },
        select: { persistent: true },
      });
      expect(rows.map((r) => r.persistent).sort()).toEqual([false, true]);
    });

    it('ends the access token in hand when its session signs out', async () => {
      const learner = await account('logout');
      const { session, token } = await signIn(learner.email);
      expectStatus(await bearer(token), 200);
      expectStatus(await session.post('/auth/logout'), 204);
      const after = await bearer(token);
      expect(after.status).toBe(401);
      expect(problemCode(after)).toBe('token_expired');
    });

    it('keeps the access token working through a refresh, in the same family and lifetime', async () => {
      const learner = await account('rotate');
      const { session, token } = await signIn(learner.email);
      const first = await prisma.session.findFirstOrThrow({ where: { userId: learner.id } });
      expectStatus(await session.post('/auth/refresh'), 200);
      // A request already on its way with the old access token is not broken by the refresh.
      expectStatus(await bearer(token), 200);
      const live = await prisma.session.findMany({
        where: { userId: learner.id, revokedAt: null },
      });
      expect(live).toHaveLength(1);
      expect(live[0]!.familyId).toBe(first.familyId);
      // The sign-in's lifetime, not thirty days from each refresh.
      expect(live[0]!.expiresAt.getTime()).toBe(first.expiresAt.getTime());
    });

    it('does not refresh past the lifetime of the sign-in', async () => {
      const learner = await account('lifetime');
      const { session } = await signIn(learner.email);
      await prisma.session.updateMany({
        where: { userId: learner.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const res = await session.post('/auth/refresh');
      expect(res.status).toBe(401);
      expect(problemCode(res)).toBe('token_expired');
    });

    it('ends a session signed out from another device, access token included', async () => {
      const learner = await account('devices');
      const laptop = await signIn(learner.email);
      const phone = await signIn(learner.email);
      const listed = expectStatus(await laptop.session.get('/auth/sessions'), 200).body as {
        id: string;
        current: boolean;
      }[];
      const other = listed.find((s) => !s.current)!;
      expectStatus(await laptop.session.delete(`/auth/sessions/${other.id}`), 204);
      expect((await bearer(phone.token)).status).toBe(401);
      expectStatus(await bearer(laptop.token), 200);
    });

    it('ends the access token of a session an administrator ends', async () => {
      const learner = await account('admin-ends');
      const { token } = await signIn(learner.email);
      const row = await prisma.session.findFirstOrThrow({ where: { userId: learner.id } });
      expectStatus(await admin.delete(`/users/${learner.id}/sessions/${row.id}`), 204);
      expect((await bearer(token)).status).toBe(401);
    });

    it('lets two tabs refresh with the same token at once, and both carry on', async () => {
      const learner = await account('tabs');
      const { session } = await signIn(learner.email);
      const shared = session.cookie('lms_rt')!;
      const [one, two] = await Promise.all([refreshWith(shared), refreshWith(shared)]);
      expectStatus(one, 200);
      expectStatus(two, 200);
      for (const res of [one, two]) {
        expectStatus(await bearer((res.body as { accessToken: string }).accessToken), 200);
      }
      const reuse = await prisma.auditLog.count({
        where: { action: 'auth.refresh_reuse_detected', resourceId: learner.id },
      });
      expect(reuse).toBe(0);
    });

    it('treats a rotated token presented again later as leaked, and ends the family', async () => {
      const learner = await account('replay');
      const { session, token } = await signIn(learner.email);
      const old = session.cookie('lms_rt')!;
      expectStatus(await session.post('/auth/refresh'), 200);
      // Past the grace window that covers two tabs refreshing together.
      await prisma.session.updateMany({
        where: { refreshTokenHash: hashToken(old) },
        data: {
          revokedAt: new Date(Date.now() - 60_000),
          rotatedAt: new Date(Date.now() - 60_000),
        },
      });
      const replay = await refreshWith(old);
      expect(replay.status).toBe(401);
      expect((await session.post('/auth/refresh')).status).toBe(401);
      expect((await bearer(token)).status).toBe(401);
      expect(await prisma.session.count({ where: { userId: learner.id, revokedAt: null } })).toBe(
        0,
      );
    });

    it('signs a person out everywhere when their roles change, refresh token included', async () => {
      const staff = await account('roles', 'active', SYSTEM_ROLES.TRAINER);
      const { session, token } = await signIn(staff.email);
      expectStatus(
        await admin.put(`/users/${staff.id}/roles`, { roleKeys: [SYSTEM_ROLES.CONTENT_MANAGER] }),
        200,
      );
      expect((await bearer(token)).status).toBe(401);
      expect((await session.post('/auth/refresh')).status).toBe(401);
      const again = await signIn(staff.email);
      const me = expectStatus(await again.session.get('/me'), 200).body as {
        roles: { key: string }[];
      };
      expect(me.roles.map((r) => r.key)).toEqual([SYSTEM_ROLES.CONTENT_MANAGER]);
    });

    it('starts the failure count again with a lock, so one slip after it does not re-lock', async () => {
      const learner = await account('lockout');
      const anon = new Session(app);
      for (let i = 0; i < 5; i += 1) {
        expect((await anon.login(learner.email, `${password}-wrong`)).status).toBe(401);
      }
      const locked = await prisma.user.findUniqueOrThrow({ where: { id: learner.id } });
      expect(locked.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
      expect(locked.failedLoginCount).toBe(0);
    });

    it('does not count a successful sign-in as one of the five tries', async () => {
      const learner = await account('many-sign-ins');
      for (let i = 0; i < 7; i += 1) {
        expectStatus(await new Session(app).login(learner.email, password), 200);
      }
      // Wrong passwords still count: five, then the limit.
      const anon = new Session(app);
      const statuses: number[] = [];
      for (let i = 0; i < 6; i += 1) {
        statuses.push((await anon.login(learner.email, `${password}-wrong`)).status);
      }
      expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
    });

    it('refuses a sign-in posted from another site, and accepts one from the app', async () => {
      const learner = await account('origin');
      const foreign = await request(server())
        .post('/api/v1/auth/login')
        .set('Origin', 'https://attacker.example')
        .send({ email: learner.email, password });
      expect(foreign.status).toBe(403);
      expect(problemCode(foreign)).toBe('csrf_failed');
      expect(foreign.headers['set-cookie']).toBeUndefined();
      const own = await request(server())
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .send({ email: learner.email, password });
      expectStatus(own, 200);
    });
  });

  describe('account states', () => {
    it('keeps a suspended account out: sign-in, sessions, invitations and reset links', async () => {
      const person = await account('suspended');
      const { session, token } = await signIn(person.email);
      const invitation = await invitationFor(person.id);
      const resetLink = await resetLinkFor(person.id);
      await prisma.user.update({ where: { id: person.id }, data: { status: 'suspended' } });
      authContext.invalidate(person.id);

      expect((await bearer(token)).status).toBe(401);
      expect((await session.post('/auth/refresh')).status).toBe(401);
      const login = await new Session(app).login(person.email, password);
      expect(login.status).toBe(401);
      expect(problemCode(login)).toBe('account_inactive');
      // An old invitation does not switch the account back on, nor set its password.
      expect((await accept(invitation)).status).toBe(410);
      expect((await reset(resetLink)).status).toBe(410);
      const after = await prisma.user.findUniqueOrThrow({ where: { id: person.id } });
      expect(after.status).toBe('suspended');
      expect((await new Session(app).login(person.email, password)).status).toBe(401);
      // Forgetting the password sends nothing to an account that is not active.
      const before = await prisma.passwordReset.count({ where: { userId: person.id } });
      expect(
        (await request(server()).post('/api/v1/auth/password/forgot').send({ email: person.email }))
          .status,
      ).toBe(202);
      expect(await prisma.passwordReset.count({ where: { userId: person.id } })).toBe(before);
    });

    it('blocks a deactivated account at once and lets it back in when reactivated', async () => {
      const person = await account('deactivated');
      const { session, token } = await signIn(person.email);
      expectStatus(
        await admin.post(`/users/${person.id}/deactivate`, { reason: 'Left the institute' }),
        204,
      );
      expect((await bearer(token)).status).toBe(401);
      expect((await session.post('/auth/refresh')).status).toBe(401);
      expect(problemCode(await new Session(app).login(person.email, password))).toBe(
        'account_inactive',
      );
      const lateLink = await resetLinkFor(person.id);
      expect((await reset(lateLink)).status).toBe(410);

      expectStatus(await admin.post(`/users/${person.id}/reactivate`), 204);
      const back = await signIn(person.email);
      expectStatus(await bearer(back.token), 200);
    });

    it('lets nobody into an erased account', async () => {
      const person = await account('erased');
      const profile = await prisma.studentProfile.create({
        data: { userId: person.id, studentCode: `STU-HARD-${unique}`, status: 'active' },
      });
      const { token } = await signIn(person.email);
      expectStatus(
        await admin.post(`/users/${person.id}/privacy/erase`, {
          confirmEmail: person.email,
          reason: 'Asked for erasure',
        }),
        200,
      );
      expect(profile.id).toBeTruthy();
      expect((await bearer(token)).status).toBe(401);
      const login = await new Session(app).login(person.email, password);
      expect(login.status).toBe(401);
      expect(problemCode(login)).toBe('invalid_credentials');
    });
  });

  describe('invitations and reset links', () => {
    it('does not let a leftover invitation replace an active account’s password', async () => {
      const person = await account('active-invite');
      const leftover = await invitationFor(person.id);
      const res = await accept(leftover, `Hijack-${unique}-password`);
      expect(res.status).toBe(409);
      expect(problemCode(res)).toBe('token_used');
      expectStatus(await new Session(app).login(person.email, password), 200);
    });

    it('activates an invited account once, even when the link is sent twice at once', async () => {
      const person = await account('invited', 'invited');
      const link = await invitationFor(person.id);
      const results = await Promise.all([accept(link), accept(link)]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: person.id } });
      expect(user.status).toBe('active');
      expect((await accept(link)).status).toBe(409);
    });

    it('ends an earlier invitation when a new one is sent', async () => {
      const person = await account('resend', 'invited');
      const earlier = await invitationFor(person.id);
      expectStatus(await admin.post(`/users/${person.id}/invitations/resend`), 202);
      expect((await accept(earlier)).status).toBe(410);
    });

    it('ends every reset link when the password changes, by reset or by the person', async () => {
      const person = await account('resets');
      const first = await resetLinkFor(person.id);
      const second = await resetLinkFor(person.id);
      expectStatus(await reset(first), 204);
      const reused = await reset(second);
      expect(reused.status).toBe(409);
      expect(problemCode(reused)).toBe('token_used');

      const changed = `Reset-${unique}-password`;
      const session = new Session(app);
      expectStatus(await session.login(person.email, changed), 200);
      const third = await resetLinkFor(person.id);
      expectStatus(
        await session.post('/auth/password/change', {
          currentPassword: changed,
          newPassword: `Changed-${unique}-password`,
        }),
        200,
      );
      expect((await reset(third)).status).toBe(409);
    });

    it('sends reset and invitation links straight away, never through the job queue', async () => {
      // A queued job keeps its payload in the database for days; only a token's hash may be stored.
      const email = app.get(EmailService);
      const queued = vi.spyOn(email, 'queue');
      const sent = vi.spyOn(email, 'sendNow');
      try {
        const person = await account('no-queue');
        const invited = await account('no-queue-invited', 'invited');
        await request(server()).post('/api/v1/auth/password/forgot').send({ email: person.email });
        expectStatus(await admin.post(`/users/${invited.id}/invitations/resend`), 202);
        // The reset is prepared after the reply, so a known address is not the slower answer.
        await new Promise((resolve) => setTimeout(resolve, 500));
        const links = sent.mock.calls.map(([message]) => JSON.stringify(message));
        expect(links.some((m) => m.includes('/reset-password/'))).toBe(true);
        expect(links.some((m) => m.includes(person.email))).toBe(true);
        expect(links.some((m) => m.includes(invited.email))).toBe(true);
        const queuedText = queued.mock.calls.map(([message]) => JSON.stringify(message));
        expect(
          queuedText.filter((m) => m.includes(person.email) || m.includes(invited.email)),
        ).toEqual([]);
      } finally {
        queued.mockRestore();
        sent.mockRestore();
      }
    });
  });
});
