import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

export const rbacManifest = defineModule({
  key: 'rbac',
  name: 'Roles and permissions',
  version: '0.1.0',
  core: true,
  permissions: permissionsForModule('rbac'),
  navigation: [
    {
      key: 'admin.settings.roles',
      portal: 'admin',
      label: 'Roles',
      route: '/admin/settings/roles',
      icon: 'shield',
      order: 930,
      group: 'Settings',
      permission: 'roles:read',
    },
  ],
  flags: [],
  settingsSections: [],
  events: { publishes: ['role.changed'], subscribes: [] },
  dependsOn: [],
});
