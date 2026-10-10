/**
 * System role keys seeded by the platform. An institute may rename roles and edit bundles,
 * but these keys are stable identifiers used by seeds, tests and default navigation.
 */
export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  TRAINER: 'trainer',
  STUDENT: 'student',
  PLACEMENT_COORDINATOR: 'placement_coordinator',
  CONTENT_MANAGER: 'content_manager',
} as const;

export type SystemRoleKey = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

/** Which portal a role lands on after sign-in (first match wins by priority order). */
export const ROLE_HOME_PORTAL: Record<SystemRoleKey, 'admin' | 'trainer' | 'student'> = {
  super_admin: 'admin',
  admin: 'admin',
  placement_coordinator: 'admin',
  content_manager: 'admin',
  trainer: 'trainer',
  student: 'student',
};

/** Priority used when a user holds several roles: the highest-priority role's portal is the home. */
export const ROLE_PRIORITY: SystemRoleKey[] = [
  'super_admin',
  'admin',
  'placement_coordinator',
  'content_manager',
  'trainer',
  'student',
];
