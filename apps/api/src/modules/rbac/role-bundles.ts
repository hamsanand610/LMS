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
      // Phase 3 — learning foundation
      { key: 'courses:read', scope: 'all' },
      { key: 'courses:manage', scope: 'all' },
      { key: 'courses:publish', scope: 'all' },
      { key: 'progress:read', scope: 'all' },
      { key: 'sessions:read', scope: 'all' },
      { key: 'sessions:manage', scope: 'all' },
      { key: 'sessions:run', scope: 'all' },
      // Phase 4 — the question bank, assignments and tests
      { key: 'questions:read', scope: 'all' },
      // Whoever manages the bank also writes in it, so the authoring grant comes with it. Its
      // scope is `own` because that is all the permission offers; `questions:manage` above is
      // what lets an administrator edit somebody else's question.
      { key: 'questions:create_own', scope: 'own' },
      { key: 'questions:manage', scope: 'all' },
      { key: 'questions:import', scope: 'all' },
      { key: 'assignments:read', scope: 'all' },
      { key: 'assignments:manage', scope: 'all' },
      { key: 'assignments:publish', scope: 'all' },
      { key: 'assignments:grade', scope: 'all' },
      { key: 'tests:read', scope: 'all' },
      { key: 'tests:manage', scope: 'all' },
      { key: 'tests:schedule', scope: 'all' },
      { key: 'tests:grade', scope: 'all' },
      { key: 'tests:release', scope: 'all' },
      { key: 'tests:monitor', scope: 'all' },
      { key: 'practice:manage', scope: 'all' },
      // Roadmap Phase 1 (ADR-0018) — labs: own labs into the catalogue; every learner's attempts
      { key: 'practice:publish_own', scope: 'own' },
      { key: 'practice:review', scope: 'all' },
      // Phase 5 — attendance and reporting
      { key: 'attendance:read', scope: 'all' },
      { key: 'attendance:mark', scope: 'all' },
      { key: 'attendance:manage', scope: 'all' },
      { key: 'reports:export', scope: 'all' },
      // Task 2 (ADR-0014) — placements, the leaderboard and the doubts queue
      { key: 'placements:read', scope: 'all' },
      { key: 'placements:manage', scope: 'all' },
      { key: 'leaderboard:read', scope: 'all' },
      { key: 'doubts:answer', scope: 'all' },
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
      // Phase 3 — teaches the batches they are assigned to
      { key: 'courses:read', scope: 'batch' },
      { key: 'progress:read', scope: 'batch' },
      { key: 'sessions:read', scope: 'batch' },
      { key: 'sessions:run', scope: 'batch' },
      // Phase 4 — authors their own questions; runs assessment for their own batches
      { key: 'questions:read', scope: 'own' },
      { key: 'questions:create_own', scope: 'own' },
      { key: 'assignments:read', scope: 'batch' },
      { key: 'assignments:manage', scope: 'batch' },
      { key: 'assignments:publish', scope: 'batch' },
      { key: 'assignments:grade', scope: 'batch' },
      { key: 'tests:read', scope: 'batch' },
      { key: 'tests:manage', scope: 'batch' },
      { key: 'tests:schedule', scope: 'batch' },
      { key: 'tests:grade', scope: 'batch' },
      { key: 'tests:release', scope: 'batch' },
      { key: 'tests:monitor', scope: 'batch' },
      // Phase 5 — marks their own classes and exports their own batches' figures
      { key: 'attendance:read', scope: 'batch' },
      { key: 'attendance:mark', scope: 'batch' },
      { key: 'reports:export', scope: 'batch' },
      // Task 2 (ADR-0014) — their batches' leaderboard and doubts
      { key: 'leaderboard:read', scope: 'batch' },
      { key: 'doubts:answer', scope: 'batch' },
      // Roadmap Phase 1 (ADR-0018) — puts the labs they wrote in the catalogue; sees their
      // batches' attempts. Placing a lab in a course stays with whoever manages courses.
      { key: 'practice:publish_own', scope: 'own' },
      { key: 'practice:review', scope: 'batch' },
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
      // Phase 3 — the courses published to them, and their own progress and timetable
      { key: 'courses:read', scope: 'own' },
      { key: 'progress:read', scope: 'own' },
      { key: 'sessions:read', scope: 'own' },
      // Phase 4 — answers assignments, sits tests, practises coding
      { key: 'assignments:read', scope: 'own' },
      { key: 'assignments:submit', scope: 'own' },
      { key: 'tests:read', scope: 'own' },
      { key: 'tests:attempt', scope: 'own' },
      { key: 'practice:use', scope: 'own' },
      // Phase 5 — sees their own attendance
      { key: 'attendance:read', scope: 'own' },
      // Phase 6 — their own profile, resumes and documents
      { key: 'profile:read', scope: 'own' },
      { key: 'profile:update', scope: 'own' },
      // Task 2 (ADR-0014) — interview prep and drives, their batch's leaderboard, doubts
      { key: 'placements:read', scope: 'own' },
      { key: 'placements:apply', scope: 'own' },
      { key: 'leaderboard:read', scope: 'own' },
      { key: 'doubts:ask', scope: 'own' },
    ],
  },
  [SYSTEM_ROLES.PLACEMENT_COORDINATOR]: {
    name: 'Placement Coordinator',
    description: 'Manages companies, interview-prep kits, drives and applications',
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
      { key: 'progress:read', scope: 'all' },
      { key: 'sessions:read', scope: 'all' },
      // Phase 4 — reads results when preparing a placement shortlist
      { key: 'tests:read', scope: 'all' },
      // Phase 5 — attendance is a placement eligibility criterion
      { key: 'attendance:read', scope: 'all' },
      { key: 'reports:export', scope: 'all' },
      // Task 2 (ADR-0014) — the placement module
      { key: 'placements:read', scope: 'all' },
      { key: 'placements:manage', scope: 'all' },
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
      // Authors content but never publishes it.
      { key: 'courses:read', scope: 'all' },
      { key: 'courses:manage', scope: 'all' },
      // Phase 4 — authors questions and assignments, but never publishes or schedules them.
      { key: 'questions:read', scope: 'all' },
      { key: 'questions:create_own', scope: 'own' },
      { key: 'questions:manage', scope: 'all' },
      { key: 'questions:import', scope: 'all' },
      { key: 'assignments:read', scope: 'all' },
      { key: 'assignments:manage', scope: 'all' },
      { key: 'tests:read', scope: 'all' },
      { key: 'tests:manage', scope: 'all' },
      { key: 'practice:manage', scope: 'all' },
      { key: 'practice:publish_own', scope: 'own' },
    ],
  },
};
