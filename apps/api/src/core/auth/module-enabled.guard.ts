import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES } from '@lms/shared';
import { ForbiddenError } from '../http/errors.js';
import { ModuleStateService } from '../registry/module-state.service.js';
import { MODULE_KEY } from './decorators.js';

/**
 * Blocks routes of modules that a client has disabled through feature flags.
 * Core modules are never disabled. Runs before the permission guard.
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
    const enabled = await this.moduleState.isEnabled(moduleKey);
    if (!enabled)
      throw new ForbiddenError(
        'This feature is not enabled for your institute',
        ERROR_CODES.MODULE_DISABLED,
      );
    return true;
  }
}
