import { defineModule } from '@lms/module-sdk';
import { FOUNDATION_PERMISSIONS } from '@lms/shared';

export const filesManifest = defineModule({
  key: 'files',
  name: 'Files',
  version: '0.1.0',
  core: true,
  permissions: FOUNDATION_PERMISSIONS.filter((p) => p.moduleKey === 'files'),
  navigation: [],
  flags: [],
  settingsSections: [],
  events: { publishes: ['file.uploaded'], subscribes: [] },
  dependsOn: [],
});
