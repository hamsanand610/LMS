import type { GrantedPermission, PermissionScope } from '@lms/shared';

/** The authenticated caller as attached to the request by the auth guard. */
export interface AuthUser {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  status: 'invited' | 'active' | 'suspended' | 'deactivated';
  roleKeys: string[];
  permissions: GrantedPermission[];
  tokenVersion: number;
  sessionId: string | null;
}

/** Scopes from the widest to the narrowest. */
export const SCOPE_ORDER: readonly PermissionScope[] = ['all', 'batch', 'own'];

/** Returns the widest scope the user holds for a permission, or null when not granted. */
export function scopeFor(user: AuthUser, permissionKey: string): PermissionScope | null {
  let best: PermissionScope | null = null;
  for (const granted of user.permissions) {
    if (granted.key !== permissionKey) continue;
    if (best === null || SCOPE_ORDER.indexOf(granted.scope) < SCOPE_ORDER.indexOf(best)) {
      best = granted.scope;
    }
  }
  return best;
}

/** Whether the user holds a permission at `scope` or wider. */
export function holdsAtLeast(
  user: AuthUser,
  permissionKey: string,
  scope: PermissionScope,
): boolean {
  const held = scopeFor(user, permissionKey);
  return held !== null && SCOPE_ORDER.indexOf(held) <= SCOPE_ORDER.indexOf(scope);
}

export function hasPermission(user: AuthUser, permissionKey: string): boolean {
  return scopeFor(user, permissionKey) !== null;
}

export const ACCESS_COOKIE = 'lms_at';
export const REFRESH_COOKIE = 'lms_rt';
export const CSRF_COOKIE = 'lms_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export interface AccessTokenPayload {
  sub: string;
  tv: number;
  sid: string | null;
}
