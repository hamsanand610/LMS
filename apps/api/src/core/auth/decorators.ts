import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { PermissionScope } from '@lms/shared';
import type { AuthUser } from './auth-user.js';

export const IS_PUBLIC_KEY = 'lms:public';
export const PERMISSION_KEY = 'lms:permission';
export const MODULE_KEY = 'lms:module';

/** Marks a handler (or controller) as reachable without authentication. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export interface PermissionRequirement {
  key: string;
  /** Minimum scope accepted; the guard records the caller's effective scope on the request. */
  minScope?: PermissionScope;
}

/** Declares the permission an authenticated handler requires. Every non-public route must have one. */
export const RequirePermission = (key: string, options: Omit<PermissionRequirement, 'key'> = {}) =>
  SetMetadata(PERMISSION_KEY, { key, ...options } satisfies PermissionRequirement);

/**
 * Handlers that only need a signed-in user (own data) declare this instead of a catalogue permission.
 * Implemented as the implicit permission `auth:self`.
 */
export const AuthenticatedOnly = () =>
  SetMetadata(PERMISSION_KEY, { key: 'auth:self' } satisfies PermissionRequirement);

/** Associates a controller with a module key so disabled modules are blocked by the module guard. */
export const ModuleScope = (moduleKey: string) => SetMetadata(MODULE_KEY, moduleKey);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!req.user) throw new Error('CurrentUser used on a route without authentication');
    return req.user;
  },
);

/** The scope the permission guard resolved for the current request (all | batch | own). */
export const EffectiveScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PermissionScope => {
    const req = ctx.switchToHttp().getRequest<{ permissionScope?: PermissionScope }>();
    return req.permissionScope ?? 'own';
  },
);
