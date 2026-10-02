import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES } from '@lms/shared';
import { ForbiddenError } from '../http/errors.js';
import type { AuthUser } from './auth-user.js';
import { ModuleStateService } from '../registry/module-state.service.js';
import { MODULE_KEY } from './decorators.js';

/**
 * Blocks routes of modules that a client has disabled through feature flags, or whose flag's
 * audience (roles, batches) the caller is outside. Core modules are never disabled. Runs before the
 * permission guard.
 */
@Injectable()
export class ModuleEnabledGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly moduleState: ModuleStateService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleKey = this.reflector.getAllAndOverride<string | undefined>(MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!moduleKey) return true;
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    const enabled = await this.moduleState.isEnabledFor(moduleKey, user);
    if (!enabled)
      throw new ForbiddenError(
        'This feature is not switched on for you',
        ERROR_CODES.MODULE_DISABLED,
      );
    return true;
  }
}
