import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export interface RequestContext {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
  /** Set by the auth guard once the caller is known. */
  userId: string | null;
  /** True when the request authenticated through cookies (CSRF protection applies). */
  cookieAuth: boolean;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** Puts a request context (id, ip, user agent) into async-local storage for services such as audit. */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const headerId = req.headers['x-request-id'];
    const requestId =
      (req as Request & { id?: string }).id ??
      (typeof headerId === 'string' && headerId.length <= 64 ? headerId : randomUUID());
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ??
      req.socket?.remoteAddress ??
      null;
    const userAgent =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent'].slice(0, 400)
        : null;
    runWithRequestContext({ requestId, ip, userAgent, userId: null, cookieAuth: false }, () =>
      next(),
    );
  }
}
