import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
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
  UnauthenticatedError,
} from '../../core/http/errors.js';
import { getRequestContext } from '../../core/http/request-context.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { BrandingService } from '../settings/branding.service.js';
import {
  generateOpaqueToken,
  hashPassword,
  hashToken,
  isCommonPassword,
  verifyPassword,
} from './password.js';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const RESET_TTL_MINUTES = 30;

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  expiresIn: number;
  sessionId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly email: EmailService,
    private readonly branding: BrandingService,
    private readonly authContext: AuthContextService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // ───────────── sign in / tokens ─────────────

  async login(
    email: string,
    password: string,
    deviceLabel: string | null,
  ): Promise<{ user: { id: string; name: string; email: string }; tokens: IssuedTokens }> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
    if (!user || !user.passwordHash) throw new InvalidCredentialsError();
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError(
        423,
        ERROR_CODES.ACCOUNT_LOCKED,
        'Account locked',
        `Too many failed attempts. Try again after ${LOCK_MINUTES} minutes.`,
      );
    }
    if (user.status !== 'active') {
      throw new AppError(
        401,
        ERROR_CODES.ACCOUNT_INACTIVE,
        'Account inactive',
        'This account is not active. Contact your administrator.',
      );
    }
    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) {
      const failed = user.failedLoginCount + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failed,
          lockedUntil:
            failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      });
      await this.audit.record({
        action: 'auth.login_failed',
        resourceType: 'user',
        resourceId: user.id,
        actorId: null,
        summary: 'Failed sign-in',
      });
      throw new InvalidCredentialsError();
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    const tokens = await this.createSession(user.id, user.tokenVersion, deviceLabel, null);
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
      await this.prisma.session.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
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
    if (
      session.expiresAt <= new Date() ||
      session.user.status !== 'active' ||
      session.user.deletedAt
    ) {
      throw new UnauthenticatedError('Session expired. Sign in again.', ERROR_CODES.TOKEN_EXPIRED);
    }
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), lastUsedAt: new Date() },
    });
    return this.createSession(
      session.userId,
      session.user.tokenVersion,
      deviceLabel ?? session.deviceLabel,
      session.familyId,
    );
  }

  async logout(sessionId: string | null, userId: string): Promise<void> {
    if (sessionId) {
      await this.prisma.session.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
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
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundError('Session');
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
    if (invitation.user.deletedAt || invitation.user.status === 'deactivated')
      throw new GoneError('This account is no longer available.');
    this.assertPasswordPolicy(password);

    const passwordHash = await hashPassword(password);
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: invitation.userId },
        data: {
          passwordHash,
          status: 'active',
          emailVerifiedAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
        },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
      return updated;
    });
    this.authContext.invalidate(user.id);
    const tokens = await this.createSession(user.id, user.tokenVersion, null, null);
    await this.audit.record({
      action: 'auth.invitation_accepted',
      resourceType: 'user',
      resourceId: user.id,
      actorId: user.id,
      summary: 'Invitation accepted',
    });
    this.events.emit('user.invitation_accepted', { userId: user.id });
    return { user: { id: user.id, name: user.name, email: user.email }, tokens };
  }

  // ───────────── passwords ─────────────

  /** Always resolves without revealing whether the email exists. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null, status: 'active' },
    });
    if (!user) return;
    const token = generateOpaqueToken();
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
      },
    });
    const brand = await this.branding.emailBrand();
    const message = passwordResetEmail(brand, {
      name: user.name,
      url: `${this.config.WEB_BASE_URL}/reset-password/${token}`,
      expiresInMinutes: RESET_TTL_MINUTES,
    });
    await this.email.queue({ to: user.email, ...message });
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
    this.assertPasswordPolicy(password);
    const passwordHash = await hashPassword(password);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
          failedLoginCount: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      this.prisma.session.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
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
    // The caller keeps working with a fresh session.
    return this.createSession(user.id, updated.tokenVersion, null, null);
  }

  // ───────────── internals ─────────────

  private assertPasswordPolicy(password: string): void {
    if (isCommonPassword(password))
      throw new DomainRuleError(
        'This password is too common. Choose a less predictable one.',
        'password_too_common',
      );
  }

  private async createSession(
    userId: string,
    tokenVersion: number,
    deviceLabel: string | null,
    familyId: string | null,
  ): Promise<IssuedTokens> {
    const ctx = getRequestContext();
    const refreshToken = generateOpaqueToken();
    const session = await this.prisma.session.create({
      data: {
        userId,
        familyId: familyId ?? randomUUID(),
        refreshTokenHash: hashToken(refreshToken),
        deviceLabel: deviceLabel?.slice(0, 120) ?? null,
        ip: ctx?.ip ?? null,
        userAgent: ctx?.userAgent ?? null,
        expiresAt: new Date(Date.now() + this.config.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
        lastUsedAt: new Date(),
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
    };
  }
}
