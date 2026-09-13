import { defineModule } from '@lms/module-sdk';
import { FOUNDATION_PERMISSIONS } from '@lms/shared';

export const auditManifest = defineModule({
  key: 'audit',
  name: 'Audit log',
  version: '0.1.0',
  core: true,
  permissions: FOUNDATION_PERMISSIONS.filter((p) => p.moduleKey === 'audit'),
  navigation: [
    {
      key: 'admin.settings.audit',
      portal: 'admin',
      label: 'Audit log',
      route: '/admin/settings/audit-log',
      icon: 'scroll-text',
      order: 960,
      group: 'Settings',
      permission: 'audit:read',
    },
  ],
  flags: [],
  settingsSections: [],
  events: { publishes: [], subscribes: [] },
  dependsOn: [],
});
