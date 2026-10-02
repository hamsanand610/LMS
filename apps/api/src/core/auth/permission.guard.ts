import { type CanActivate, type ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionScope } from '@lms/shared';
import { ForbiddenError } from '../http/errors.js';
import { type AuthUser, holdsAtLeast, scopeFor } from './auth-user.js';
import { IS_PUBLIC_KEY, PERMISSION_KEY, type PermissionRequirement } from './decorators.js';

/**
 * Global authorisation guard. A non-public route must declare a permission; the caller must hold it.
 * The resolved scope is stored on the request for services to filter their queries.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requirement = this.reflector.getAllAndOverride<PermissionRequirement | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    const req = context.switchToHttp().getRequest<{
      user?: AuthUser;
      permissionScope?: PermissionScope;
      route?: { path?: string };
    }>();

    if (!requirement) {
      // Deny by default: a route without a declaration is a programming error, not a grant.
      this.logger.error({ path: req.route?.path }, 'Route has no permission declaration');
      throw new ForbiddenError('This route is not configured for access');
    }
    const user = req.user;
    if (!user) throw new ForbiddenError();

    const scope = scopeFor(user, requirement.key);
    if (scope === null) throw new ForbiddenError();
    if (requirement.minScope && !holdsAtLeast(user, requirement.key, requirement.minScope)) {
      throw new ForbiddenError();
    }
    req.permissionScope = scope;
    return true;
  }
}
