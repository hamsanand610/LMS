import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { ERROR_CODES, type SessionSummary } from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { AuthContextService } from '../../core/auth/auth-context.service.js';
import type { AccessTokenPayload, AuthUser } from '../../core/auth/auth-user.js';
import { APP_CONFIG, type AppConfig } from '../../core/config/env.js';
import { EmailService } from '../../core/email/email.service.js';
import { passwordChangedEmail, passwordResetEmail } from '../../core/email/templates.js';
import {
  AppError,
  ConflictError,
  DomainRuleError,
  GoneError,
  InvalidCredentialsError,
  NotFoundError,
  RateLimitedError,
  UnauthenticatedError,
} from '../../core/http/errors.js';
import { getRequestContext } from '../../core/http/request-context.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { MemoryRateLimitStore } from '../../core/rate-limit/memory-store.js';
import { BrandingService } from '../settings/branding.service.js';
import { ContentPagesService } from '../settings/content-pages.service.js';
import { EmailTemplatesService } from '../settings/email-templates.service.js';
import {
  generateOpaqueToken,
  hashPassword,
  hashToken,
  isCommonPassword,
  passwordEngineName,
  verifyPassword,
} from './password.js';

const MAX_FAILED_LOGINS = 5;
/**
 * How long a just-rotated refresh token is still accepted from the same family (Phase 6): two
 * tabs refreshing together send the same token, and only one can rotate it. Later than this, the
 * token presented again is treated as leaked and the family ends.
 */
const REFRESH_GRACE_MS = 30_000;
const LOCK_MINUTES = 15;
const RESET_TTL_MINUTES = 30;
/** Password changes per account per quarter of an hour, whichever session they come from. */
const PASSWORD_CHANGES = 5;
const PASSWORD_CHANGE_WINDOW_MS = 15 * 60_000;

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  expiresIn: number;
  sessionId: string;
  /** Whether the cookies should outlive the browser: the sign-in's choice, kept by refreshes. */
  persistent: boolean;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  /**
   * The route's own limit counts per session, because rate limits run before authentication; a
   * refreshed session would start a fresh count. This one counts per account, so the current
   * password cannot be guessed by refreshing between tries.
   */
  private readonly passwordChanges = new MemoryRateLimitStore();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly email: EmailService,
    private readonly branding: BrandingService,
    private readonly templates: EmailTemplatesService,
    private readonly authContext: AuthContextService,
    private readonly pages: ContentPagesService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Settles the password-hashing engine at start-up, so the first sign-in does not pay for it, and
   * says in the log when the WebAssembly engine is standing in for the native one (ADR-0016).
   */
  async onModuleInit(): Promise<void> {
    const engine = await passwordEngineName();
    if (engine === 'wasm') {
      this.logger.warn(
        'The native argon2 binding could not be loaded on this machine; passwords are hashed with the WebAssembly engine (same algorithm and format).',
      );
    }
  }

  /** A hash of a random secret nobody holds, checked when the account does not exist. */
  private decoy: Promise<string> | null = null;
  private decoyHash(): Promise<string> {
    this.decoy ??= hashPassword(generateOpaqueToken());
    return this.decoy;
  }

  // ───────────── sign in / tokens ─────────────

  async login(
    email: string,
    password: string,
    deviceLabel: string | null,
    rememberMe = true,
  ): Promise<{ user: { id: string; name: string; email: string }; tokens: IssuedTokens }> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.normalize('NFKC').trim().toLowerCase(), deletedAt: null },
    });
    if (!user || !user.passwordHash) {
      // The same Argon2 work as a real check, so the answer takes as long whether or not the
      // account exists.
      await verifyPassword(await this.decoyHash(), password);
      throw new InvalidCredentialsError();
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      // Worded exactly like the rate limiter's answer, which is what an address that does not
      // belong to anybody gets after the same number of tries: a lock does not confirm an account.
      throw new RateLimitedError(Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000));
    }
    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) {
      // Counted in the database, so two attempts at the same moment are both counted.
      const counted = await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: { increment: 1 } },
        select: { failedLoginCount: true },
      });
      if (counted.failedLoginCount >= MAX_FAILED_LOGINS) {
        // The count starts again with the lock, so when it lifts the account has the same tries
        // as an address nobody owns: a second lock after one wrong password would tell (Phase 6).
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000),
            failedLoginCount: 0,
          },
        });
      }
      await this.audit.record({
        action: 'auth.login_failed',
        resourceType: 'user',
        resourceId: user.id,
        actorId: null,
        summary: 'Failed sign-in',
      });
      throw new InvalidCredentialsError();
    }
    // Only somebody who knows the password learns that the account is switched off.
    if (user.status !== 'active') {
      throw new AppError(
        401,
        ERROR_CODES.ACCOUNT_INACTIVE,
        'Account inactive',
        'This account is not active. Contact your administrator.',
      );
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    const tokens = await this.createSession(user.id, user.tokenVersion, deviceLabel, null, {
      persistent: rememberMe,
    });
    await this.audit.record({
      action: 'auth.login',
      resourceType: 'user',
      resourceId: user.id,
      actorId: user.id,
      summary: 'Signed in',
    });
    this.events.emit('user.logged_in', { userId: user.id, ip: getRequestContext()?.ip ?? null });
    return { user: { id: user.id, name: user.name, email: user.email }, tokens };
  }

  /** Rotates the refresh token. A previously rotated token being presented again revokes the whole family. */
  async refresh(refreshToken: string, deviceLabel: string | null): Promise<IssuedTokens> {
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hashToken(refreshToken) },
      include: { user: true },
    });
    if (!session)
      throw new UnauthenticatedError(
        'Session not found. Sign in again.',
        ERROR_CODES.TOKEN_EXPIRED,
      );
    if (session.revokedAt) {
      // Rotated a moment ago by another tab of the same browser: that tab won the race, this one
      // gets a session of its own in the family. Later than that, or once the family was signed
      // out, the token presented again may have leaked (Phase 6).
      if (await this.withinRotationGrace(session)) return this.siblingSession(session, deviceLabel);
      await this.revokeFamily(session.familyId, session.userId);
      await this.audit.record({
        action: 'auth.refresh_reuse_detected',
        resourceType: 'user',
        resourceId: session.userId,
        actorId: null,
        summary: 'Refresh token reuse; session family revoked',
      });
      throw new UnauthenticatedError(
        'Session invalidated. Sign in again.',
        ERROR_CODES.TOKEN_EXPIRED,
      );
    }
    if (!this.mayHoldSession(session)) {
      throw new UnauthenticatedError('Session expired. Sign in again.', ERROR_CODES.TOKEN_EXPIRED);
    }
    // Claimed: of two requests presenting the token at once, one rotates it here. The other came
    // from the same browser in the same instant — another tab — and continues the family too,
    // unless what beat it was a sign-out (Phase 6).
    const now = new Date();
    const claimed = await this.prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: now, rotatedAt: now, lastUsedAt: now },
    });
    if (claimed.count === 0) {
      const current = await this.prisma.session.findUnique({
        where: { id: session.id },
        include: { user: true },
      });
      if (!current || !(await this.withinRotationGrace(current))) {
        throw new UnauthenticatedError(
          'Session invalidated. Sign in again.',
          ERROR_CODES.TOKEN_EXPIRED,
        );
      }
    }
    return this.siblingSession(session, deviceLabel);
  }

  /**
   * Whether a revoked session was rotated moments ago in a family nobody signed out: the case of
   * two tabs refreshing with the same token.
   */
  private async withinRotationGrace(session: {
    familyId: string;
    rotatedAt: Date | null;
    expiresAt: Date;
    user: { status: string; deletedAt: Date | null };
  }): Promise<boolean> {
    if (!session.rotatedAt || Date.now() - session.rotatedAt.getTime() >= REFRESH_GRACE_MS) {
      return false;
    }
    if (!this.mayHoldSession(session)) return false;
    const signedOut = await this.prisma.session.count({
      where: { familyId: session.familyId, revokedAt: { not: null }, rotatedAt: null },
    });
    return signedOut === 0;
  }

  /** Whether a session's account and lifetime still allow a new access token. */
  private mayHoldSession(session: {
    expiresAt: Date;
    user: { status: string; deletedAt: Date | null };
  }): boolean {
    return (
      session.expiresAt > new Date() && session.user.status === 'active' && !session.user.deletedAt
    );
  }

  /**
   * The next session of a family. It lives as long as the sign-in it came from — not 30 days from
   * each refresh — and keeps that sign-in's choice of being remembered (Phase 6).
   */
  private siblingSession(
    session: {
      userId: string;
      familyId: string;
      deviceLabel: string | null;
      persistent: boolean;
      expiresAt: Date;
      user: { tokenVersion: number };
    },
    deviceLabel: string | null,
  ): Promise<IssuedTokens> {
    return this.createSession(
      session.userId,
      session.user.tokenVersion,
      deviceLabel ?? session.deviceLabel,
      session.familyId,
      { persistent: session.persistent, expiresAt: session.expiresAt },
    );
  }

  async logout(sessionId: string | null, userId: string): Promise<void> {
    if (sessionId) {
      const session = await this.prisma.session.findFirst({
        where: { id: sessionId, userId },
        select: { familyId: true },
      });
      // The whole family: the access token in hand may belong to a session a refresh has rotated.
      if (session) await this.revokeFamily(session.familyId, userId);
    }
    await this.audit.record({
      action: 'auth.logout',
      resourceType: 'user',
      resourceId: userId,
      summary: 'Signed out',
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } }),
    ]);
    this.authContext.invalidate(userId);
    await this.audit.record({
      action: 'auth.logout_all',
      resourceType: 'user',
      resourceId: userId,
      summary: 'Signed out everywhere',
    });
  }

  async listSessions(userId: string, currentSessionId: string | null): Promise<SessionSummary[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      deviceLabel: s.deviceLabel,
      ip: s.ip,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt?.toISOString() ?? null,
      expiresAt: s.expiresAt.toISOString(),
      current: s.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId, revokedAt: null },
      select: { familyId: true },
    });
    if (!session) throw new NotFoundError('Session');
    await this.revokeFamily(session.familyId, userId);
    await this.audit.record({
      action: 'auth.session_revoked',
      resourceType: 'session',
      resourceId: sessionId,
      summary: 'Session revoked',
    });
  }

  // ───────────── invitations ─────────────

  async acceptInvitation(
    token: string,
    password: string,
    consents: { terms: true; privacy: true } = { terms: true, privacy: true },
  ): Promise<{ user: { id: string; name: string; email: string }; tokens: IssuedTokens }> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!invitation) throw new NotFoundError('Invitation');
    if (invitation.acceptedAt)
      throw new ConflictError('This invitation was already used', ERROR_CODES.TOKEN_USED);
    if (invitation.expiresAt <= new Date())
      throw new GoneError('This invitation has expired. Ask your administrator to resend it.');
    // Only an account still waiting for its invitation takes it up: a suspended, deactivated or
    // erased one is not brought back by an old link, and an active one's password is not replaced
    // by a leftover one (Phase 6).
    if (invitation.user.deletedAt || invitation.user.status !== 'invited') {
      if (invitation.user.status === 'active' && !invitation.user.deletedAt) {
        throw new ConflictError(
          'This account is already active. Sign in instead.',
          ERROR_CODES.TOKEN_USED,
        );
      }
      throw new GoneError('This account is no longer available.');
    }
    this.assertPasswordPolicy(password);

    const passwordHash = await hashPassword(password);
    const now = new Date();
    const user = await this.prisma.$transaction(async (tx) => {
      // Claimed, so two acceptances at once cannot both pass.
      const claimed = await tx.invitation.updateMany({
        where: { id: invitation.id, acceptedAt: null },
        data: { acceptedAt: now },
      });
      if (claimed.count === 0) {
        throw new ConflictError('This invitation was already used', ERROR_CODES.TOKEN_USED);
      }
      const activated = await tx.user.updateMany({
        where: { id: invitation.userId, status: 'invited', deletedAt: null },
        data: {
          passwordHash,
          status: 'active',
          emailVerifiedAt: now,
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: now,
        },
      });
      if (activated.count === 0) throw new GoneError('This account is no longer available.');
      // Any other invitation still out for this person ends with this one.
      await tx.invitation.updateMany({
        where: { userId: invitation.userId, acceptedAt: null, expiresAt: { gt: now } },
        data: { expiresAt: now },
      });
      return tx.user.findUniqueOrThrow({ where: { id: invitation.userId } });
    });
    this.authContext.invalidate(user.id);
    const tokens = await this.createSession(user.id, user.tokenVersion, null, null);
    // What the person agreed to, and which text it was: the Terms of Service and the Privacy
    // Policy as they read at that moment (their title and date), kept with the acceptance.
    await this.audit.record({
      action: 'auth.invitation_accepted',
      resourceType: 'user',
      resourceId: user.id,
      actorId: user.id,
      summary: 'Invitation accepted',
      after: {
        consents,
        documents: {
          terms: await this.documentInForce('terms'),
          privacy: await this.documentInForce('privacy'),
        },
      },
    });
    this.events.emit('user.invitation_accepted', { userId: user.id });
    return { user: { id: user.id, name: user.name, email: user.email }, tokens };
  }

  /** A legal page as a visitor reads it now: its title and date, or null when there is none. */
  private async documentInForce(
    slug: 'terms' | 'privacy',
  ): Promise<{ title: string; updatedAt: string } | null> {
    try {
      const page = await this.pages.publicPage(slug);
      return { title: page.title, updatedAt: page.updatedAt };
    } catch {
      return null;
    }
  }

  // ───────────── passwords ─────────────

  /**
   * Always resolves without revealing whether the email exists, in what it says and in how long it
   * takes: the reset is prepared after the reply, so a known address is not the slower answer.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        email: email.normalize('NFKC').trim().toLowerCase(),
        deletedAt: null,
        status: 'active',
      },
    });
    if (!user) return;
    void this.sendPasswordReset(user).catch((error: unknown) => {
      this.logger.error({ err: error, userId: user.id }, 'A password reset could not be prepared');
    });
  }

  private async sendPasswordReset(user: { id: string; name: string; email: string }) {
    const token = generateOpaqueToken();
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
      },
    });
    const brand = await this.branding.emailBrand();
    const message = passwordResetEmail(
      brand,
      {
        name: user.name,
        url: `${this.config.WEB_BASE_URL}/reset-password/${token}`,
        expiresInMinutes: RESET_TTL_MINUTES,
      },
      await this.templates.resolve('password_reset', {
        name: user.name,
        brandName: brand.brandName,
        expiresInMinutes: RESET_TTL_MINUTES,
      }),
    );
    // Sent now rather than queued: a queued job keeps its payload — this link — in the database
    // for days, and only the token's hash may be stored (Phase 6).
    await this.email.sendNow({ to: user.email, ...message });
    await this.audit.record({
      action: 'auth.password_reset_requested',
      resourceType: 'user',
      resourceId: user.id,
      actorId: null,
      summary: 'Password reset requested',
    });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const reset = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!reset) throw new NotFoundError('Reset link');
    if (reset.usedAt)
      throw new ConflictError('This reset link was already used', ERROR_CODES.TOKEN_USED);
    if (reset.expiresAt <= new Date())
      throw new GoneError('This reset link has expired. Request a new one.');
    // A link sent before the account was switched off does not switch it back on (Phase 6).
    if (reset.user.deletedAt || reset.user.status !== 'active')
      throw new GoneError('This account is no longer available.');
    this.assertPasswordPolicy(password);
    const passwordHash = await hashPassword(password);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      // Claimed, so the link works once even when used twice at the same moment.
      const claimed = await tx.passwordReset.updateMany({
        where: { id: reset.id, usedAt: null },
        data: { usedAt: now },
      });
      if (claimed.count === 0) {
        throw new ConflictError('This reset link was already used', ERROR_CODES.TOKEN_USED);
      }
      await tx.user.update({
        where: { id: reset.userId },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      // Every other link sent to the account ends with this one.
      await tx.passwordReset.updateMany({
        where: { userId: reset.userId, usedAt: null },
        data: { usedAt: now },
      });
      await tx.session.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: now },
      });
    });
    this.authContext.invalidate(reset.userId);
    const brand = await this.branding.emailBrand();
    await this.email.queue({
      to: reset.user.email,
      ...passwordChangedEmail(brand, { name: reset.user.name }),
    });
    await this.audit.record({
      action: 'auth.password_reset',
      resourceType: 'user',
      resourceId: reset.userId,
      actorId: reset.userId,
      summary: 'Password reset via link',
    });
    this.events.emit('user.password_changed', { userId: reset.userId });
  }

  async changePassword(
    user: AuthUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<IssuedTokens> {
    const attempt = await this.passwordChanges.hit(user.id, PASSWORD_CHANGE_WINDOW_MS);
    if (attempt.count > PASSWORD_CHANGES) {
      throw new RateLimitedError(Math.max(1, Math.ceil((attempt.resetAt - Date.now()) / 1000)));
    }
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!row.passwordHash || !(await verifyPassword(row.passwordHash, currentPassword)))
      throw new InvalidCredentialsError();
    this.assertPasswordPolicy(newPassword);
    const passwordHash = await hashPassword(newPassword);
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      // A reset link sent before the change no longer works (Phase 6).
      await tx.passwordReset.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      return u;
    });
    this.authContext.invalidate(user.id);
    const brand = await this.branding.emailBrand();
    await this.email.queue({ to: row.email, ...passwordChangedEmail(brand, { name: row.name }) });
    await this.audit.record({
      action: 'auth.password_changed',
      resourceType: 'user',
      resourceId: user.id,
      summary: 'Password changed',
    });
    this.events.emit('user.password_changed', { userId: user.id });
    // The caller keeps working with a fresh session, remembered as the one it replaces was.
    const current = user.sessionId
      ? await this.prisma.session.findUnique({
          where: { id: user.sessionId },
          select: { persistent: true },
        })
      : null;
    return this.createSession(user.id, updated.tokenVersion, null, null, {
      persistent: current?.persistent ?? true,
    });
  }

  // ───────────── internals ─────────────

  private assertPasswordPolicy(password: string): void {
    if (isCommonPassword(password))
      throw new DomainRuleError(
        'This password is too common. Choose a less predictable one.',
        'password_too_common',
      );
  }

  /** Ends every session of a family, and with them their access tokens (the guard asks). */
  private async revokeFamily(familyId: string, userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.authContext.invalidate(userId);
  }

  private async createSession(
    userId: string,
    tokenVersion: number,
    deviceLabel: string | null,
    familyId: string | null,
    options: { persistent?: boolean; expiresAt?: Date } = {},
  ): Promise<IssuedTokens> {
    const ctx = getRequestContext();
    const refreshToken = generateOpaqueToken();
    const persistent = options.persistent ?? true;
    const session = await this.prisma.session.create({
      data: {
        userId,
        familyId: familyId ?? randomUUID(),
        refreshTokenHash: hashToken(refreshToken),
        deviceLabel: deviceLabel?.slice(0, 120) ?? null,
        ip: ctx?.ip ?? null,
        userAgent: ctx?.userAgent ?? null,
        expiresAt:
          options.expiresAt ??
          new Date(Date.now() + this.config.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
        lastUsedAt: new Date(),
        persistent,
      },
    });
    const payload: AccessTokenPayload = { sub: userId, tv: tokenVersion, sid: session.id };
    const accessToken = await this.jwt.signAsync(payload);
    return {
      accessToken,
      refreshToken,
      csrfToken: generateOpaqueToken(),
      expiresIn: this.config.JWT_ACCESS_TTL_SECONDS,
      sessionId: session.id,
      persistent,
    };
  }
}
