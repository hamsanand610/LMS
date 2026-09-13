import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ERROR_CODES, type ProblemDetails } from '@lms/shared';
import { AppError, RateLimitedError } from './errors.js';

/**
 * Converts every error into an RFC 9457 problem+json response.
 * Stack traces never reach clients; the request id lets support find the log line.
 */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = (req as Request & { id?: string }).id ?? req.headers['x-request-id'];
    const instance = req.originalUrl ?? req.url;

    let problem: ProblemDetails;

    if (exception instanceof AppError) {
      problem = {
        type: `urn:lms:error:${exception.code}`,
        title: exception.title,
        status: exception.status,
        detail: exception.detail,
        code: exception.code,
        instance,
        requestId: typeof requestId === 'string' ? requestId : undefined,
        errors: exception.issues,
      };
      if (exception instanceof RateLimitedError) {
        res.setHeader('Retry-After', String(exception.retryAfterSeconds));
      }
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const detail =
        typeof body === 'string'
          ? body
          : typeof body === 'object' && body !== null && 'message' in body
            ? Array.isArray((body as { message: unknown }).message)
              ? (body as { message: string[] }).message.join('; ')
              : String((body as { message: unknown }).message)
            : exception.message;
      problem = {
        type: `urn:lms:error:http_${status}`,
        title: exception.name.replace(/Exception$/, '') || 'Error',
        status,
        detail,
        code:
          status === 404
            ? ERROR_CODES.NOT_FOUND
            : status === 401
              ? ERROR_CODES.UNAUTHENTICATED
              : status === 403
                ? ERROR_CODES.FORBIDDEN
                : `http_${status}`,
        instance,
        requestId: typeof requestId === 'string' ? requestId : undefined,
      };
    } else {
      this.logger.error(
        {
          err:
            exception instanceof Error
              ? { message: exception.message, stack: exception.stack }
              : exception,
          requestId,
        },
        'Unhandled exception',
      );
      problem = {
        type: `urn:lms:error:${ERROR_CODES.INTERNAL}`,
        title: 'Internal server error',
        status: 500,
        detail: 'Something went wrong on our side. Share the request id with support.',
        code: ERROR_CODES.INTERNAL,
        instance,
        requestId: typeof requestId === 'string' ? requestId : undefined,
      };
    }

    res.status(problem.status).type('application/problem+json').json(problem);
  }
}
