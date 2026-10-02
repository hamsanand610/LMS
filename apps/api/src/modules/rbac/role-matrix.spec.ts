import { describe, expect, it } from 'vitest';
import { PLATFORM_PERMISSIONS, SYSTEM_ROLES } from '@lms/shared';
import { SYSTEM_ROLE_DEFINITIONS } from './role-bundles.js';

/**
 * The role–permission matrix of the architecture plan (§13.2), asserted rather than described.
 *
 * This is the check the plan's Phase 6 calls "permission testing (matrix, scopes)". It catches the
 * two ways a bundle goes wrong between phases: a permission granted to somebody the plan does not
 * give it to, and a permission the plan gives that a later edit dropped.
 */

/** What §13.2 says each role holds, as `permission:scope`. */
const MATRIX: Record<string, string[]> = {
  [SYSTEM_ROLES.ADMIN]: [
    'users:read:all',
    'users:manage:all',
    'users:import:all',
    'roles:read:all',
    'settings:read:all',
    'audit:read:own',
    'students:read:all',
    'students:manage:all',
    'students:read_sensitive:all',
    'students:verify_documents:all',
    'trainers:read:all',
    'trainers:manage:all',
    'batches:read:all',
    'batches:manage:all',
    'programs:manage:all',
    'courses:read:all',
    'courses:manage:all',
    'courses:publish:all',
    // Phases 3–4 (ADR-0023)
    'courses:author:all',
    'progress:read:all',
    'sessions:read:all',
    'sessions:manage:all',
    'sessions:run:all',
    'attendance:read:all',
    'attendance:mark:all',
    'attendance:manage:all',
    'questions:read:all',
    'questions:create_own:own',
    'questions:manage:all',
    'questions:import:all',
    'assignments:read:all',
    'assignments:manage:all',
    'assignments:publish:all',
    'assignments:grade:all',
    'tests:read:all',
    'tests:manage:all',
    'tests:schedule:all',
    'tests:grade:all',
    'tests:release:all',
    'tests:monitor:all',
    'practice:manage:all',
    'practice:publish_own:own',
    'practice:review:all',
    'reports:read:all',
    'reports:export:all',
    'notifications:broadcast:all',
    'notifications:read:own',
    'announcements:manage:all',
    'files:upload:all',
    'files:read:all',
    'search:use:all',
    'placements:read:all',
    // Task 2 (ADR-0014)
    'placements:manage:all',
    'leaderboard:read:all',
    'doubts:answer:all',
    // Phase 2 (ADR-0022)
    'certificates:read:all',
  ],
  [SYSTEM_ROLES.TRAINER]: [
    'students:read:batch',
    'trainers:read:own',
    'batches:read:batch',
    'courses:read:batch',
    // Phases 3–4 (ADR-0023): the courses they are staff of
    'courses:author:own',
    'courses:publish:batch',
    'progress:read:batch',
    'sessions:read:batch',
    'sessions:run:batch',
    'attendance:read:batch',
    'attendance:mark:batch',
    'questions:read:own',
    'questions:create_own:own',
    'assignments:read:batch',
    'assignments:manage:batch',
    'assignments:publish:batch',
    'assignments:grade:batch',
    'tests:read:batch',
    'tests:manage:batch',
    'tests:schedule:batch',
    'tests:grade:batch',
    'tests:release:batch',
    'tests:monitor:batch',
    'reports:read:batch',
    'reports:export:batch',
    'notifications:broadcast:batch',
    'notifications:read:own',
    'files:upload:own',
    'files:read:own',
    'search:use:batch',
    // Task 2 (ADR-0014)
    'leaderboard:read:batch',
    'doubts:answer:batch',
    'practice:publish_own:own',
    'practice:review:batch',
    // Phase 2 (ADR-0022)
    'certificates:read:batch',
  ],
  [SYSTEM_ROLES.STUDENT]: [
    'courses:read:own',
    'progress:read:own',
    'sessions:read:own',
    'attendance:read:own',
    'assignments:read:own',
    'assignments:submit:own',
    'tests:read:own',
    'tests:attempt:own',
    'practice:use:own',
    'profile:read:own',
    'profile:update:own',
    'placements:read:own',
    'placements:apply:own',
    // Task 2 (ADR-0014)
    'leaderboard:read:own',
    'doubts:ask:own',
    'notifications:read:own',
    'files:upload:own',
    'files:read:own',
    'search:use:own',
    // Phase 2 (ADR-0022)
    'certificates:read:own',
  ],
  [SYSTEM_ROLES.PLACEMENT_COORDINATOR]: [
    'students:read:all',
    'students:read_sensitive:all',
    'students:verify_documents:all',
    'trainers:read:all',
    'batches:read:all',
    'progress:read:all',
    'sessions:read:all',
    'attendance:read:all',
    'tests:read:all',
    'reports:read:all',
    'reports:export:all',
    'placements:read:all',
    'placements:manage:all',
    'notifications:read:own',
    'files:upload:own',
    'files:read:own',
    'search:use:all',
  ],
  [SYSTEM_ROLES.CONTENT_MANAGER]: [
    'batches:read:all',
    'courses:read:all',
    'courses:manage:all',
    'courses:author:all',
    'questions:read:all',
    'questions:create_own:own',
    'questions:manage:all',
    'questions:import:all',
    'assignments:read:all',
    'assignments:manage:all',
    'tests:read:all',
    'tests:manage:all',
    'practice:manage:all',
    'practice:publish_own:own',
    'notifications:read:own',
    'files:upload:all',
    'files:read:all',
    'search:use:all',
  ],
};

function bundleOf(role: string): string[] {
  const definition = SYSTEM_ROLE_DEFINITIONS[role];
  if (!definition) throw new Error(`No definition for ${role}`);
  if (definition.bundle === '*') {
    return PLATFORM_PERMISSIONS.map((permission) => `${permission.key}:all`).sort();
  }
  return definition.bundle.map((entry) => `${entry.key}:${entry.scope}`).sort();
}

describe('the role–permission matrix (architecture plan §13.2)', () => {
  for (const [role, expected] of Object.entries(MATRIX)) {
    it(`${role} holds exactly what the plan gives it`, () => {
      expect(bundleOf(role)).toEqual([...expected].sort());
    });
  }

  it('the Super Admin holds every permission in the catalogue, at scope all', () => {
    const bundle = bundleOf(SYSTEM_ROLES.SUPER_ADMIN);
    expect(bundle).toHaveLength(PLATFORM_PERMISSIONS.length);
    expect(bundle.every((entry) => entry.endsWith(':all'))).toBe(true);
  });

  it('every granted permission exists in the catalogue', () => {
    const known = new Set(PLATFORM_PERMISSIONS.map((permission) => permission.key));
    for (const [role, definition] of Object.entries(SYSTEM_ROLE_DEFINITIONS)) {
      if (definition.bundle === '*') continue;
      for (const entry of definition.bundle) {
        expect(known.has(entry.key), `${role} is granted the unknown "${entry.key}"`).toBe(true);
      }
    }
  });

  it('every granted scope is one the permission offers', () => {
    const byKey = new Map(PLATFORM_PERMISSIONS.map((permission) => [permission.key, permission]));
    for (const [role, definition] of Object.entries(SYSTEM_ROLE_DEFINITIONS)) {
      if (definition.bundle === '*') continue;
      for (const entry of definition.bundle) {
        const permission = byKey.get(entry.key);
        expect(
          permission?.scopes.includes(entry.scope),
          `${role} holds ${entry.key} at "${entry.scope}", which that permission does not offer`,
        ).toBe(true);
      }
    }
  });

  it('nobody but the Super Admin may change settings, branding, flags or roles', () => {
    const guarded = ['settings:manage', 'branding:manage', 'flags:manage', 'roles:manage'];
    for (const [role, definition] of Object.entries(SYSTEM_ROLE_DEFINITIONS)) {
      if (role === SYSTEM_ROLES.SUPER_ADMIN || definition.bundle === '*') continue;
      const keys = definition.bundle.map((entry) => entry.key);
      for (const key of guarded) {
        expect(keys, `${role} must not hold ${key}`).not.toContain(key);
      }
    }
  });

  it('a learner holds nothing beyond their own records', () => {
    const student = SYSTEM_ROLE_DEFINITIONS[SYSTEM_ROLES.STUDENT];
    if (!student || student.bundle === '*') throw new Error('The student bundle is missing');
    for (const entry of student.bundle) {
      expect(entry.scope, `${entry.key} is granted to a student at "${entry.scope}"`).toBe('own');
    }
  });
});
