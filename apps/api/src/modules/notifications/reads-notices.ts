import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Observable, mergeMap } from 'rxjs';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { NotificationsService } from './notifications.service.js';

const READS_NOTICES = 'notifications:reads-notices';

/** The page an endpoint serves, as a notice's link names it. */
type Page = string | ((source: { params: Record<string, string>; body: unknown }) => string | null);

interface ReadsNoticesSpec {
  page: Page;
  anyPortal: boolean;
}

/**
 * Marks the endpoint as the one a page loads its subject from (Phase 5): once it has answered,
 * the caller's unread notices that lead to that page are read — a review read on its question, a
 * result read on its page — and nothing else is. `page` is a link template whose `:name` parts
 * come from the route (`'/assignments/:id'`), or a function of the route and the answer when the
 * link names something the route does not. `anyPortal` also matches the page under a portal
 * prefix (`/trainer/doubts/<id>` for `/doubts/<id>`).
 */
export const ReadsNotices = (page: Page, options: { anyPortal?: boolean } = {}) =>
  SetMetadata(READS_NOTICES, {
    page,
    anyPortal: options.anyPortal ?? false,
  } satisfies ReadsNoticesSpec);

/** Applies `@ReadsNotices` after the handler has answered; registered for the whole API. */
@Injectable()
export class ReadsNoticesInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ReadsNoticesInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly notifications: NotificationsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const spec = this.reflector.get<ReadsNoticesSpec | undefined>(
      READS_NOTICES,
      context.getHandler(),
    );
    if (!spec) return next.handle();
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthUser; params?: Record<string, string> }>();
    return next.handle().pipe(
      mergeMap(async (body: unknown) => {
        const user = request.user;
        const params = request.params ?? {};
        const page =
          typeof spec.page === 'string'
            ? spec.page.replace(/:([A-Za-z]+)/g, (_, name: string) => params[name] ?? '')
            : spec.page({ params, body });
        if (user && page) {
          // Reading is a courtesy to the bell: it never fails the page that was asked for.
          await this.notifications
            .markReadAt(user.id, page, { anyPortal: spec.anyPortal })
            .catch((error: unknown) =>
              this.logger.warn({ err: error, page }, 'Could not mark notices read'),
            );
        }
        return body;
      }),
    );
  }
}
