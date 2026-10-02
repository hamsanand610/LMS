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

/**
 * Phase 2 (admin foundation) catalogue: people, cohorts, communication and the dashboard.
 * Scopes list what a client may choose in the matrix; `batch` exists wherever a trainer
 * should see only the records of the batches they are assigned to.
 */
export const ADMIN_FOUNDATION_PERMISSIONS = definePermissions([
  // students
  {
    key: 'students:read',
    moduleKey: 'students',
    description: 'View student records',
    scopes: ['all', 'batch'],
  },
  {
    key: 'students:manage',
    moduleKey: 'students',
    description: 'Create, edit and change the status of students',
    scopes: ['all'],
  },
  {
    key: 'students:read_sensitive',
    moduleKey: 'students',
    description: 'See personal details and documents of students',
    scopes: ['all'],
  },
  {
    key: 'students:verify_documents',
    moduleKey: 'students',
    description: 'Verify or reject uploaded student documents',
    scopes: ['all'],
  },
  // trainers
  {
    key: 'trainers:read',
    moduleKey: 'trainers',
    description: 'View trainer records',
    scopes: ['all', 'own'],
  },
  {
    key: 'trainers:manage',
    moduleKey: 'trainers',
    description: 'Create and edit trainers and their batch assignments',
    scopes: ['all'],
  },
  // batches and programmes
  {
    key: 'batches:read',
    moduleKey: 'batches',
    description: 'View batches and their rosters',
    scopes: ['all', 'batch'],
  },
  {
    key: 'batches:manage',
    moduleKey: 'batches',
    description: 'Create batches, manage members, trainers and status',
    scopes: ['all'],
  },
  {
    key: 'programs:manage',
    moduleKey: 'batches',
    description: 'Create and edit programmes',
    scopes: ['all'],
  },
  // notifications and announcements
  {
    key: 'notifications:broadcast',
    moduleKey: 'notifications',
    description: 'Send a message to a group of people',
    scopes: ['all', 'batch'],
  },
  {
    key: 'announcements:manage',
    moduleKey: 'notifications',
    description:
      'Create and schedule announcements (batch = to the batches one teaches, and only one’s own)',
    scopes: ['all', 'batch'],
  },
  // reports (dashboard subset; exports arrive with the reporting module)
  {
    key: 'reports:read',
    moduleKey: 'reports',
    description: 'View the dashboard and reports',
    scopes: ['all', 'batch'],
  },
]);

/**
 * Phase 3 (learning foundation) catalogue: content, the progress it produces and live sessions.
 * `courses:read` at scope `own` means "the courses published to me"; at `batch` it means the
 * courses published to the batches a trainer teaches.
 */
export const LEARNING_PERMISSIONS = definePermissions([
  // courses
  {
    key: 'courses:read',
    moduleKey: 'courses',
    description: 'Open courses and lessons',
    scopes: ['all', 'batch', 'own'],
  },
  {
    key: 'courses:manage',
    moduleKey: 'courses',
    description: 'Create, archive and staff courses, and change any of them',
    scopes: ['all'],
  },
  {
    key: 'courses:author',
    moduleKey: 'courses',
    description: "Change a course's details and outline (own = the courses one is staff of)",
    scopes: ['all', 'own'],
  },
  {
    key: 'courses:publish',
    moduleKey: 'courses',
    description:
      'Publish a course to a programme or a batch (batch = a course one is staff of, to a batch one teaches)',
    scopes: ['all', 'batch'],
  },
  // progress
  {
    key: 'progress:read',
    moduleKey: 'progress',
    description: 'See how far learners have got',
    scopes: ['all', 'batch', 'own'],
  },
  // sessions
  {
    key: 'sessions:read',
    moduleKey: 'sessions',
    description: 'See the timetable',
    scopes: ['all', 'batch', 'own'],
  },
  {
    key: 'sessions:manage',
    moduleKey: 'sessions',
    description: 'Create and reschedule class series and sessions',
    scopes: ['all'],
  },
  {
    key: 'sessions:run',
    moduleKey: 'sessions',
    description: 'Start or finish a session and attach its recording',
    scopes: ['all', 'batch'],
  },
]);

/** Every permission this build can grant. Seeds, the registry and the matrix read this list. */
/**
 * Phase 4 permission catalogue: the question bank, assignments, tests and coding practice.
 */
export const ASSESSMENT_PERMISSIONS = definePermissions([
  // questions
  {
    key: 'questions:read',
    moduleKey: 'questions',
    description: 'Browse the question bank',
    scopes: ['all', 'own'],
  },
  {
    key: 'questions:create_own',
    moduleKey: 'questions',
    description: 'Author questions and edit the ones you wrote',
    scopes: ['own'],
  },
  {
    key: 'questions:manage',
    moduleKey: 'questions',
    description: 'Edit, publish and retire any question',
    scopes: ['all'],
  },
  {
    key: 'questions:import',
    moduleKey: 'questions',
    description: 'Import questions from a spreadsheet',
    scopes: ['all'],
  },
  // assignments
  {
    key: 'assignments:read',
    moduleKey: 'assignments',
    description: 'Open assignments',
    scopes: ['all', 'batch', 'own'],
  },
  {
    key: 'assignments:submit',
    moduleKey: 'assignments',
    description: 'Answer the questions in an assignment',
    scopes: ['own'],
  },
  {
    key: 'assignments:manage',
    moduleKey: 'assignments',
    description: 'Create assignments and edit their structure',
    scopes: ['all', 'batch'],
  },
  {
    key: 'assignments:publish',
    moduleKey: 'assignments',
    description: 'Publish an assignment to a batch',
    scopes: ['all', 'batch'],
  },
  {
    key: 'assignments:grade',
    moduleKey: 'assignments',
    description: 'Mark written answers',
    scopes: ['all', 'batch'],
  },
  // tests
  {
    key: 'tests:read',
    moduleKey: 'tests',
    description: 'See tests and their results',
    scopes: ['all', 'batch', 'own'],
  },
  {
    key: 'tests:attempt',
    moduleKey: 'tests',
    description: 'Sit a test',
    scopes: ['own'],
  },
  {
    key: 'tests:manage',
    moduleKey: 'tests',
    description: 'Build a test and set its rules',
    scopes: ['all', 'batch'],
  },
  {
    key: 'tests:schedule',
    moduleKey: 'tests',
    description: 'Open a test to a batch for a window of time',
    scopes: ['all', 'batch'],
  },
  {
    key: 'tests:grade',
    moduleKey: 'tests',
    description: 'Mark written answers in a test',
    scopes: ['all', 'batch'],
  },
  {
    key: 'tests:release',
    moduleKey: 'tests',
    description: 'Release results to the learners who sat the test',
    scopes: ['all', 'batch'],
  },
  {
    key: 'tests:monitor',
    moduleKey: 'tests',
    description: 'Watch a test while it is running',
    scopes: ['all', 'batch'],
  },
  // practice
  {
    key: 'practice:use',
    moduleKey: 'practice',
    description: 'Solve coding practice problems',
    scopes: ['own'],
  },
  {
    key: 'practice:manage',
    moduleKey: 'practice',
    description: 'Choose which problems appear in the practice catalogue',
    scopes: ['all'],
  },
  {
    key: 'practice:publish_own',
    moduleKey: 'practice',
    description: 'Put labs you wrote in the Labs catalogue, or take them out',
    scopes: ['own'],
  },
  {
    key: 'practice:review',
    moduleKey: 'practice',
    description: "See learners' lab attempts and submissions",
    scopes: ['all', 'batch'],
  },
]);

/**
 * Phase 5 permission catalogue: attendance and the reporting that reads every other module.
 * `attendance:mark` is the roll call itself and the corrections a trainer may make inside the
 * window; `attendance:manage` is what an administrator needs to correct a record after it.
 */
export const OPERATIONS_PERMISSIONS = definePermissions([
  // attendance
  {
    key: 'attendance:read',
    moduleKey: 'attendance',
    description: 'See who attended a class',
    scopes: ['all', 'batch', 'own'],
  },
  {
    key: 'attendance:mark',
    moduleKey: 'attendance',
    description: 'Take the roll call for a class and correct it inside the window',
    scopes: ['all', 'batch'],
  },
  {
    key: 'attendance:manage',
    moduleKey: 'attendance',
    description: 'Correct attendance after the window has closed',
    scopes: ['all'],
  },
  // reports
  {
    key: 'reports:export',
    moduleKey: 'reports',
    description: 'Export a report as a spreadsheet',
    scopes: ['all', 'batch'],
  },
]);

/**
 * Phase 6 catalogue: the learner's own record; Task 2 made the placement keys live (ADR-0014).
 */
export const SELF_SERVICE_PERMISSIONS = definePermissions([
  {
    key: 'profile:read',
    moduleKey: 'profile',
    description: 'See your own profile',
    scopes: ['own'],
  },
  {
    key: 'profile:update',
    moduleKey: 'profile',
    description: 'Edit your own profile, resumes and documents',
    scopes: ['own'],
  },
  // Placement (ADR-0014): companies, interview-prep kits, drives and applications.
  {
    key: 'placements:read',
    moduleKey: 'placement',
    description: 'See companies, interview-prep kits and placement drives',
    scopes: ['all', 'own'],
  },
  {
    key: 'placements:manage',
    moduleKey: 'placement',
    description: 'Manage companies, kits, drives and applicants',
    scopes: ['all'],
  },
  {
    key: 'placements:apply',
    moduleKey: 'placement',
    description: 'Apply to a placement drive',
    scopes: ['own'],
  },
]);

/** Task 2 catalogue (ADR-0014): the leaderboard and doubts. */
export const ENGAGEMENT_PERMISSIONS = definePermissions([
  {
    key: 'leaderboard:read',
    moduleKey: 'gamification',
    description: 'See the points leaderboard (own = your batch)',
    scopes: ['all', 'batch', 'own'],
  },
  {
    key: 'doubts:ask',
    moduleKey: 'doubts',
    description: 'Ask a doubt about a course or lesson, and follow its thread',
    scopes: ['own'],
  },
  {
    key: 'doubts:answer',
    moduleKey: 'doubts',
    description: "Answer learners' doubts",
    scopes: ['all', 'batch'],
  },
  {
    key: 'certificates:read',
    moduleKey: 'certificates',
    description: 'See certificates of course completion (own = your own)',
    scopes: ['all', 'batch', 'own'],
  },
  // Roadmap Phases 3–4 (F-18, D10) — feedback
  {
    key: 'feedback:manage',
    moduleKey: 'feedback',
    description: 'Give feedback forms to batches and read every answer',
    scopes: ['all'],
  },
  {
    key: 'feedback:read',
    moduleKey: 'feedback',
    description: 'See feedback figures and comments (own = the forms about oneself)',
    scopes: ['all', 'own'],
  },
  {
    key: 'feedback:respond',
    moduleKey: 'feedback',
    description: "Answer the feedback forms given to one's batch",
    scopes: ['own'],
  },
]);

export const PLATFORM_PERMISSIONS: PermissionDefinition[] = [
  ...FOUNDATION_PERMISSIONS,
  ...ADMIN_FOUNDATION_PERMISSIONS,
  ...LEARNING_PERMISSIONS,
  ...ASSESSMENT_PERMISSIONS,
  ...OPERATIONS_PERMISSIONS,
  ...SELF_SERVICE_PERMISSIONS,
  ...ENGAGEMENT_PERMISSIONS,
];

/** Permissions a module contributes; used by every module manifest. */
export function permissionsForModule(moduleKey: string): PermissionDefinition[] {
  return PLATFORM_PERMISSIONS.filter((p) => p.moduleKey === moduleKey);
}

export type PermissionKey = string;

/** A granted permission with its scope, as returned by GET /me. */
export interface GrantedPermission {
  key: PermissionKey;
  scope: PermissionScope;
}
