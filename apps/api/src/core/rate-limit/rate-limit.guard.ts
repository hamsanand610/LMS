import { createHash } from 'node:crypto';
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { ACCESS_COOKIE, type AccessTokenPayload, type AuthUser } from '../auth/auth-user.js';
import { RateLimitedError } from '../http/errors.js';
import { getRequestContext } from '../http/request-context.js';
import { MemoryRateLimitStore, type RateLimitStore } from './memory-store.js';
import { RATE_LIMIT_KEY, type RateLimitOptions } from './rate-limit.decorator.js';

/** Default limit for any caller: per user when known, per session when signed in, else per address. */
const DEFAULT_LIMIT: RateLimitOptions = { points: 600, durationSec: 300, keyBy: 'user' };

/**
 * How many sessions' worth of requests one address may make before it is throttled as a whole.
 * Generous, because a campus network puts a classroom behind one address; finite, because a
 * session cookie is not verified here and a made-up one would otherwise open a fresh bucket.
 */
const SESSIONS_PER_ADDRESS = 10;

/** One counter a request is charged to, and how much that counter allows. */
interface Bucket {
  key: string;
  points: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly store: RateLimitStore = new MemoryRateLimitStore();

  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const res = context.switchToHttp().getResponse<Response>();
    if ((req.originalUrl ?? req.url).startsWith('/health/')) return true;

    const declared = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    const options = declared ?? DEFAULT_LIMIT;
    // A declared limit counts per route; the default limit counts across the whole API. Sharing one
    // bucket would let a small per-route limit reject requests the default allowance had already spent.
    const scope = declared ? `${context.getClass().name}.${context.getHandler().name}` : 'default';
    const [primary, ...ceilings] = await this.buckets(req, options, scope);
    const windowMs = options.durationSec * 1000;

    // The wider ceilings first: past one of them, no new counter is opened for the request
    // (a made-up session cookie would otherwise add one per request) (Phase 6).
    for (const ceiling of ceilings) {
      const hit = await this.store.hit(ceiling.key, windowMs);
      if (hit.count > ceiling.points) throw this.limited(hit.resetAt);
    }

    const { count, resetAt } = await this.store.hit(primary!.key, windowMs);
    const remaining = Math.max(0, primary!.points - count);
    res.setHeader('RateLimit-Limit', String(primary!.points));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil((resetAt - Date.now()) / 1000)));
    if (count > primary!.points) throw this.limited(resetAt);
    if (options.countFailuresOnly) {
      // Taken back once the answer is known to be a success (Phase 6, finding on record #6).
      res.once('finish', () => {
        if (res.statusCode >= 400) return;
        for (const bucket of [primary!, ...ceilings]) void this.store.refund(bucket.key);
      });
    }
    return true;
  }

  private limited(resetAt: number): RateLimitedError {
    return new RateLimitedError(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)));
  }

  /** The bucket the headers describe first, then any wider ceilings the request also counts against. */
  private async buckets(
    req: Request & { user?: AuthUser },
    options: RateLimitOptions,
    scope: string,
  ): Promise<Bucket[]> {
    const ip = getRequestContext()?.ip ?? req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    switch (options.keyBy) {
      case 'ip':
        return [{ key: `ip:${ip}:${scope}`, points: options.points }];
      case 'ip+body': {
        const value = fingerprint(this.bodyValue(req, options.bodyField));
        return [
          { key: `ipb:${ip}:${value}:${scope}`, points: options.points },
          ...(options.valuePoints
            ? [{ key: `val:${value}:${scope}`, points: options.valuePoints }]
            : []),
          ...(options.ipPoints ? [{ key: `ip:${ip}:${scope}`, points: options.ipPoints }] : []),
        ];
      }
      case 'user':
      default: {
        if (req.user) return [{ key: `user:${req.user.id}:${scope}`, points: options.points }];
        // A route's own limit (changing a password, an import, a run) counts the person a valid
        // access token names, across refreshes, devices and tabs (Phase 6): a refresh used to start
        // a fresh count, the cookie having changed with it. The general allowance stays per
        // session, so somebody working in several tabs is not throttled as one heavy client.
        const verified = scope === 'default' ? null : await this.verifiedUserId(req);
        if (verified) return [{ key: `user:${verified}:${scope}`, points: options.points }];
        /*
         * This guard runs before authentication — deliberately, so an expensive request is
         * refused before any work is done — which means `req.user` is empty even for a signed-in
         * caller. Falling back to the address would put everybody behind one campus network into a
         * single bucket, and a whole classroom would be throttled as though it were one client.
         *
         * The session cookie identifies the caller well enough to count them separately. It is
         * not verified here, so a made-up one gets its own bucket; the address ceiling is what
         * stops that from being a way around the limit.
         */
        const session = this.sessionKey(req);
        return session
          ? [
              { key: `session:${session}:${scope}`, points: options.points },
              { key: `ipcap:${ip}:${scope}`, points: options.points * SESSIONS_PER_ADDRESS },
            ]
          : [{ key: `ip:${ip}:${scope}`, points: options.points }];
      }
    }
  }

  /** The body field a limit is keyed on, normalised the way the handler will read it. */
  private bodyValue(req: Request, field: string | undefined): string {
    if (!field) return '';
    const raw = (req.body as Record<string, unknown> | undefined)?.[field];
    return typeof raw === 'string' ? raw.normalize('NFKC').trim().toLowerCase() : '';
  }

  /**
   * The account a valid access token names, from the Authorization header or the cookie; null
   * for none, or one that does not verify (expired, made up). Checking the signature is cheap,
   * and it is what makes the count per person rather than per token.
   */
  private async verifiedUserId(req: Request): Promise<string | null> {
    const header = req.headers?.authorization;
    const token =
      typeof header === 'string' && header.startsWith('Bearer ')
        ? header.slice(7)
        : (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
    if (!token) return null;
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      return typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
      return null;
    }
  }

  /** A short, stable fingerprint of the caller's session cookie. Never the cookie itself. */
  private sessionKey(req: Request): string | null {
    const cookie = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
    if (!cookie) return null;
    return fingerprint(cookie);
  }
}

/** Keys hold a digest rather than the value: bounded in size, and no address book in memory. */
function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('base64url').slice(0, 22);
}
