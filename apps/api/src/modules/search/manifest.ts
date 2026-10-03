import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

export const searchManifest = defineModule({
  key: 'search',
  name: 'Search',
  version: '0.2.0',
  core: true,
  permissions: permissionsForModule('search'),
  navigation: [],
  flags: [],
  settingsSections: [],
  events: { publishes: [], subscribes: [] },
  dependsOn: ['auth', 'rbac', 'courses', 'assignments', 'tests', 'practice', 'questions'],
});
