import type { PermissionScope } from '@lms/shared';
import { SYSTEM_ROLES } from '@lms/shared';

export interface BundleEntry {
  key: string;
  scope: PermissionScope;
}

/**
 * Default permission bundles for the system roles (architecture plan §13.2).
 * `*` means every permission in the catalogue at scope `all`.
 * Later phases append their module permissions here; clients may edit bundles in the UI
 * (except the Super Admin bundle, which is always complete). When a new module adds
 * permissions, `syncSystemRoles` grants the new defaults once — see ADR-0009.
 */
export const SYSTEM_ROLE_DEFINITIONS: Record<
  string,
  { name: string; description: string; bundle: '*' | BundleEntry[] }
> = {
  [SYSTEM_ROLES.SUPER_ADMIN]: {
    name: 'Super Admin',
    description: 'Technical ownership: settings, branding, roles, integrations, audit',
    bundle: '*',
  },
  [SYSTEM_ROLES.ADMIN]: {
    name: 'Admin',
    description: 'Institute operations: people, batches, content, schedule, reports',
    bundle: [
      { key: 'users:read', scope: 'all' },
      { key: 'users:manage', scope: 'all' },
      { key: 'users:import', scope: 'all' },
      { key: 'roles:read', scope: 'all' },
      { key: 'settings:read', scope: 'all' },
      { key: 'audit:read', scope: 'own' },
      { key: 'files:upload', scope: 'all' },
      { key: 'files:read', scope: 'all' },
      { key: 'search:use', scope: 'all' },
      { key: 'notifications:read', scope: 'own' },
      // Phase 2 — admin foundation
      { key: 'students:read', scope: 'all' },
      { key: 'students:manage', scope: 'all' },
      { key: 'students:read_sensitive', scope: 'all' },
      { key: 'students:verify_documents', scope: 'all' },
      { key: 'trainers:read', scope: 'all' },
      { key: 'trainers:manage', scope: 'all' },
      { key: 'batches:read', scope: 'all' },
      { key: 'batches:manage', scope: 'all' },
      { key: 'programs:manage', scope: 'all' },
      { key: 'notifications:broadcast', scope: 'all' },
      { key: 'announcements:manage', scope: 'all' },
      { key: 'reports:read', scope: 'all' },
    ],
  },
  [SYSTEM_ROLES.TRAINER]: {
    name: 'Trainer',
    description:
      'Delivers classes, marks attendance, publishes assignments and tests to own batches',
    bundle: [
      { key: 'files:upload', scope: 'own' },
      { key: 'files:read', scope: 'own' },
      { key: 'search:use', scope: 'batch' },
      { key: 'notifications:read', scope: 'own' },
      // Phase 2 — sees only the batches they are assigned to
      { key: 'students:read', scope: 'batch' },
      { key: 'trainers:read', scope: 'own' },
      { key: 'batches:read', scope: 'batch' },
      { key: 'notifications:broadcast', scope: 'batch' },
      { key: 'reports:read', scope: 'batch' },
    ],
  },
  [SYSTEM_ROLES.STUDENT]: {
    name: 'Student',
    description: 'Learns, practises, takes tests and maintains a profile',
    bundle: [
      { key: 'files:upload', scope: 'own' },
      { key: 'files:read', scope: 'own' },
      { key: 'search:use', scope: 'own' },
      { key: 'notifications:read', scope: 'own' },
    ],
  },
  [SYSTEM_ROLES.PLACEMENT_COORDINATOR]: {
    name: 'Placement Coordinator',
    description: 'Manages companies, drives, applications and placement reports (module deferred)',
    bundle: [
      { key: 'files:upload', scope: 'own' },
      { key: 'files:read', scope: 'own' },
      { key: 'search:use', scope: 'all' },
      { key: 'notifications:read', scope: 'own' },
      // Phase 2 — reads people records to prepare placement work
      { key: 'students:read', scope: 'all' },
      { key: 'students:read_sensitive', scope: 'all' },
      { key: 'students:verify_documents', scope: 'all' },
      { key: 'trainers:read', scope: 'all' },
      { key: 'batches:read', scope: 'all' },
      { key: 'reports:read', scope: 'all' },
    ],
  },
  [SYSTEM_ROLES.CONTENT_MANAGER]: {
    name: 'Content Manager',
    description: 'Authors courses, question banks and kits without publishing rights',
    bundle: [
      { key: 'files:upload', scope: 'all' },
      { key: 'files:read', scope: 'all' },
      { key: 'search:use', scope: 'all' },
      { key: 'notifications:read', scope: 'own' },
      { key: 'batches:read', scope: 'all' },
    ],
  },
};
