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

    // A response already under way — an answer streaming as server-sent events (Phase 7C) — cannot
    // become a problem document: its status and headers are sent. It is closed instead, and the
    // error logged; the stream's own `error` event is how such a reader is told.
    if (res.headersSent) {
      this.logger.error(
        { requestId, err: exception instanceof Error ? exception.name : typeof exception },
        'Error after the response had started',
      );
      if (!res.writableEnded) res.end();
      return;
    }

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
    } else if (requestProblem(exception)) {
      // A database rule or an unreadable body the request itself broke: the caller's mistake, said
      // in plain words; the database's own message (which may quote values) stays out (Phase 6).
      const known = requestProblem(exception)!;
      this.logger.warn({ reason: known.reason, requestId }, 'Request refused');
      problem = {
        type: `urn:lms:error:${known.code}`,
        title: known.title,
        status: known.status,
        detail: known.detail,
        code: known.code,
        instance,
        requestId: typeof requestId === 'string' ? requestId : undefined,
      };
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
        // Nest turns the JSON parser's SyntaxError into a 400 carrying its message, which quotes the
        // body it could not read — perhaps a password. Said in plain words instead (Phase 6).
        detail:
          status === 400 && /JSON/.test(detail) ? 'The request body is not valid JSON.' : detail,
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

interface RequestProblem {
  status: number;
  code: string;
  title: string;
  detail: string;
  /** For the log: the database code or the parser's error type, never a message. */
  reason: string;
}

/**
 * Errors a request causes that are not AppErrors (Phase 6): a database constraint it broke, or a
 * body the parser could not read. Before, both answered 500 as if the server had failed.
 */
function requestProblem(exception: unknown): RequestProblem | null {
  if (!(exception instanceof Error)) return null;
  if (exception.name === 'PrismaClientKnownRequestError') {
    const code = (exception as { code?: string }).code ?? '';
    const conflict = (detail: string): RequestProblem => ({
      status: 409,
      code: ERROR_CODES.CONFLICT,
      title: 'Conflict',
      detail,
      reason: code,
    });
    if (code === 'P2002') return conflict('It conflicts with something that already exists.');
    if (code === 'P2003') {
      return conflict('It refers to something that does not exist, or is still in use.');
    }
    if (code === 'P2034') return conflict('Someone else changed it at the same time. Try again.');
    if (code === 'P2025') {
      return {
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        title: 'Not found',
        detail: 'It no longer exists.',
        reason: code,
      };
    }
    return null;
  }
  // body-parser's errors carry the status they mean and `expose` for the ones a client caused.
  const parser = exception as Error & { status?: unknown; expose?: unknown; type?: unknown };
  if (
    typeof parser.status === 'number' &&
    parser.status >= 400 &&
    parser.status < 500 &&
    parser.expose === true &&
    typeof parser.type === 'string'
  ) {
    return {
      status: parser.status,
      code: `http_${parser.status}`,
      title: parser.status === 413 ? 'Payload too large' : 'Bad request',
      detail:
        parser.type === 'entity.parse.failed'
          ? 'The request body is not valid JSON.'
          : parser.status === 413
            ? 'The request body is too large.'
            : 'The request body could not be read.',
      reason: parser.type,
    };
  }
  return null;
}
