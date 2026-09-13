import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

export const filesManifest = defineModule({
  key: 'files',
  name: 'Files',
  version: '0.1.0',
  core: true,
  permissions: permissionsForModule('files'),
  navigation: [],
  flags: [],
  settingsSections: [],
  events: { publishes: ['file.uploaded'], subscribes: [] },
  dependsOn: [],
});
