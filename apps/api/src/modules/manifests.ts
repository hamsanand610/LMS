import type { ModuleManifest } from '@lms/module-sdk';
import { auditManifest } from './audit/manifest.js';
import { authManifest } from './auth/manifest.js';
import { filesManifest } from './files/manifest.js';
import { healthManifest } from './health/manifest.js';
import { rbacManifest } from './rbac/manifest.js';
import { settingsManifest } from './settings/manifest.js';
import { usersManifest } from './users/manifest.js';

/** Every module registered in this build, in dependency order. Seeds and the registry read this list. */
export const MODULE_MANIFESTS: ModuleManifest[] = [
  settingsManifest,
  authManifest,
  rbacManifest,
  usersManifest,
  auditManifest,
  filesManifest,
  healthManifest,
];
