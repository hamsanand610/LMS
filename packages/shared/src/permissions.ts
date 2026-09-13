/**
 * Permission scopes. `all` = every record; `batch` = records of batches the user is assigned to;
 * `own` = records belonging to the user.
 */
export const PERMISSION_SCOPES = ['all', 'batch', 'own'] as const;
export type PermissionScope = (typeof PERMISSION_SCOPES)[number];

export interface PermissionDefinition {
  /** `resource:action`, e.g. `users:manage` */
  key: string;
  resource: string;
  action: string;
  /** Module that contributes the permission (module manifest key). */
  moduleKey: string;
  description: string;
  /** Scopes that make sense for this permission; the first is the default when granted. */
  scopes: readonly PermissionScope[];
}

/** Helper to declare permissions with a consistent shape. */
export function definePermissions<
  const T extends readonly Omit<PermissionDefinition, 'resource' | 'action'>[],
>(defs: T): PermissionDefinition[] {
  return defs.map((d) => {
    const [resource, action] = d.key.split(':');
    if (!resource || !action) {
      throw new Error(`Invalid permission key "${d.key}" (expected resource:action)`);
    }
    return { ...d, resource, action };
  });
}

/**
 * Phase 1 permission catalogue (auth, rbac, users, settings, audit, files, search, health).
 * Later modules add their own permissions through their manifests; this list is the
 * foundation the seeds and the route-table test rely on.
 */
export const FOUNDATION_PERMISSIONS = definePermissions([
  // rbac
  {
    key: 'roles:read',
    moduleKey: 'rbac',
    description: 'View roles and the permission matrix',
    scopes: ['all'],
  },
  {
    key: 'roles:manage',
    moduleKey: 'rbac',
    description: 'Create roles and edit permission bundles',
    scopes: ['all'],
  },
  // users
  { key: 'users:read', moduleKey: 'users', description: 'View staff accounts', scopes: ['all'] },
  {
    key: 'users:manage',
    moduleKey: 'users',
    description: 'Invite, edit, deactivate accounts and assign roles',
    scopes: ['all'],
  },
  { key: 'users:import', moduleKey: 'users', description: 'Bulk import accounts', scopes: ['all'] },
  // settings
  {
    key: 'settings:read',
    moduleKey: 'settings',
    description: 'View institute settings',
    scopes: ['all'],
  },
  {
    key: 'settings:manage',
    moduleKey: 'settings',
    description: 'Change institute settings, navigation, fields, templates, integrations',
    scopes: ['all'],
  },
  {
    key: 'branding:manage',
    moduleKey: 'settings',
    description: 'Change branding and theme',
    scopes: ['all'],
  },
  {
    key: 'flags:manage',
    moduleKey: 'settings',
    description: 'Enable or disable modules and options',
    scopes: ['all'],
  },
  // audit
  {
    key: 'audit:read',
    moduleKey: 'audit',
    description: 'View the audit log',
    scopes: ['all', 'own'],
  },
  // files
  {
    key: 'files:upload',
    moduleKey: 'files',
    description: 'Upload files in permitted contexts',
    scopes: ['all', 'own'],
  },
  {
    key: 'files:read',
    moduleKey: 'files',
    description: 'Download files in permitted contexts',
    scopes: ['all', 'own'],
  },
  // search
  {
    key: 'search:use',
    moduleKey: 'search',
    description: 'Use global search',
    scopes: ['all', 'batch', 'own'],
  },
  // notifications (foundation subset)
  {
    key: 'notifications:read',
    moduleKey: 'notifications',
    description: 'Read own notifications',
    scopes: ['own'],
  },
]);

export type PermissionKey = string;

/** A granted permission with its scope, as returned by GET /me. */
export interface GrantedPermission {
  key: PermissionKey;
  scope: PermissionScope;
}
