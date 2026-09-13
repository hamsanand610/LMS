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

/** Returns the widest scope the user holds for a permission, or null when not granted. */
export function scopeFor(user: AuthUser, permissionKey: string): PermissionScope | null {
  const order: PermissionScope[] = ['all', 'batch', 'own'];
  let best: PermissionScope | null = null;
  for (const granted of user.permissions) {
    if (granted.key !== permissionKey) continue;
    if (best === null || order.indexOf(granted.scope) < order.indexOf(best)) best = granted.scope;
  }
  return best;
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
