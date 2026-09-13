import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

export const reportsManifest = defineModule({
  key: 'reports',
  name: 'Reports',
  version: '0.2.0',
  core: false,
  permissions: permissionsForModule('reports'),
  navigation: [],
  flags: [],
  settingsSections: [],
  events: { publishes: [], subscribes: [] },
  dependsOn: ['auth', 'rbac', 'batches'],
});
