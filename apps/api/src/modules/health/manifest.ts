import { defineModule } from '@lms/module-sdk';

export const healthManifest = defineModule({
  key: 'health',
  name: 'System health',
  version: '0.1.0',
  core: true,
  permissions: [],
  navigation: [
    {
      key: 'admin.settings.health',
      portal: 'admin',
      label: 'System health',
      route: '/admin/settings/system-health',
      icon: 'activity',
      order: 970,
      group: 'Settings',
      permission: 'settings:manage',
    },
  ],
  flags: [],
  settingsSections: [],
  events: { publishes: [], subscribes: [] },
  dependsOn: [],
});
