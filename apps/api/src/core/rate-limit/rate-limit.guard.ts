import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { AuthUser } from '../auth/auth-user.js';
import { RateLimitedError } from '../http/errors.js';
import { getRequestContext } from '../http/request-context.js';
import { MemoryRateLimitStore, type RateLimitStore } from './memory-store.js';
import { RATE_LIMIT_KEY, type RateLimitOptions } from './rate-limit.decorator.js';

/** Default limit for any caller (per user id when known, otherwise per IP). */
const DEFAULT_LIMIT: RateLimitOptions = { points: 600, durationSec: 300, keyBy: 'user' };

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly store: RateLimitStore = new MemoryRateLimitStore();

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const res = context.switchToHttp().getResponse<Response>();
    if ((req.originalUrl ?? req.url).startsWith('/health/')) return true;

    const options =
      this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_LIMIT;

    const key = this.buildKey(req, options, context);
    const { count, resetAt } = await this.store.hit(key, options.durationSec * 1000);
    const remaining = Math.max(0, options.points - count);
    res.setHeader('RateLimit-Limit', String(options.points));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil((resetAt - Date.now()) / 1000)));
    if (count > options.points) {
      throw new RateLimitedError(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)));
    }
    return true;
  }

  private buildKey(
    req: Request & { user?: AuthUser },
    options: RateLimitOptions,
    context: ExecutionContext,
  ): string {
    const ip = getRequestContext()?.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const route = `${context.getClass().name}.${context.getHandler().name}`;
    switch (options.keyBy) {
      case 'ip':
        return `ip:${ip}:${route}`;
      case 'ip+body': {
        const body = req.body as Record<string, unknown> | undefined;
        const field = options.bodyField
          ? String(body?.[options.bodyField] ?? '').toLowerCase()
          : '';
        return `ipb:${ip}:${field}:${route}`;
      }
      case 'user':
      default:
        return req.user ? `user:${req.user.id}` : `ip:${ip}`;
    }
  }
}
