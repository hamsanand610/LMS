import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ERROR_CODES } from '@lms/shared';
import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { UnauthenticatedError } from '../http/errors.js';
import { getRequestContext } from '../http/request-context.js';
import { AuthContextService } from './auth-context.service.js';
import { ACCESS_COOKIE, type AccessTokenPayload, type AuthUser } from './auth-user.js';
import { IS_PUBLIC_KEY } from './decorators.js';

/**
 * Global authentication guard. Accepts a Bearer access token or the access cookie.
 * Public routes skip it; everything else gets `req.user` populated.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly authContext: AuthContextService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser; cookies?: Record<string, string> }>();
    const { token, fromCookie } = this.extractToken(req);
    if (!token) throw new UnauthenticatedError();

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthenticatedError(
        'Your session has expired. Sign in again.',
        ERROR_CODES.TOKEN_EXPIRED,
      );
    }

    const ctx = await this.authContext.load(payload.sub);
    if (!ctx) throw new UnauthenticatedError();
    if (ctx.tokenVersion !== payload.tv) {
      throw new UnauthenticatedError(
        'Your session was ended. Sign in again.',
        ERROR_CODES.TOKEN_EXPIRED,
      );
    }
    if (ctx.status !== 'active') {
      throw new UnauthenticatedError('This account is not active.', ERROR_CODES.ACCOUNT_INACTIVE);
    }

    req.user = { ...ctx, sessionId: payload.sid };
    const requestContext = getRequestContext();
    if (requestContext) {
      requestContext.userId = ctx.id;
      requestContext.cookieAuth = fromCookie;
    }
    return true;
  }

  private extractToken(req: Request & { cookies?: Record<string, string> }): {
    token: string | null;
    fromCookie: boolean;
  } {
    const header = req.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return { token: header.slice(7).trim(), fromCookie: false };
    }
    const cookie = req.cookies?.[ACCESS_COOKIE];
    if (typeof cookie === 'string' && cookie.length > 0) return { token: cookie, fromCookie: true };
    return { token: null, fromCookie: false };
  }
}
