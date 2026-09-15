import type { ModuleManifest } from '@lms/module-sdk';
import { assignmentsManifest } from './assignments/manifest.js';
import { attendanceManifest } from './attendance/manifest.js';
import { auditManifest } from './audit/manifest.js';
import { authManifest } from './auth/manifest.js';
import { batchesManifest } from './batches/manifest.js';
import { coursesManifest } from './courses/manifest.js';
import { filesManifest } from './files/manifest.js';
import { healthManifest } from './health/manifest.js';
import { notificationsManifest } from './notifications/manifest.js';
import { practiceManifest } from './practice/manifest.js';
import { progressManifest } from './progress/manifest.js';
import { questionsManifest } from './questions/manifest.js';
import { rbacManifest } from './rbac/manifest.js';
import { reportsManifest } from './reports/manifest.js';
import { searchManifest } from './search/manifest.js';
import { sessionsManifest } from './sessions/manifest.js';
import { settingsManifest } from './settings/manifest.js';
import { testsManifest } from './tests/manifest.js';
import { studentsManifest } from './students/manifest.js';
import { trainersManifest } from './trainers/manifest.js';
import { usersManifest } from './users/manifest.js';

/** Every module registered in this build, in dependency order. Seeds and the registry read this list. */
export const MODULE_MANIFESTS: ModuleManifest[] = [
  settingsManifest,
  authManifest,
  rbacManifest,
  usersManifest,
  auditManifest,
  filesManifest,
  searchManifest,
  notificationsManifest,
  studentsManifest,
  trainersManifest,
  batchesManifest,
  sessionsManifest,
  progressManifest,
  coursesManifest,
  questionsManifest,
  assignmentsManifest,
  testsManifest,
  practiceManifest,
  attendanceManifest,
  reportsManifest,
  healthManifest,
];
