import { defineModule } from '@lms/module-sdk';
import { FOUNDATION_PERMISSIONS } from '@lms/shared';

export const usersManifest = defineModule({
  key: 'users',
  name: 'Users',
  version: '0.1.0',
  core: true,
  permissions: FOUNDATION_PERMISSIONS.filter((p) => p.moduleKey === 'users'),
  navigation: [
    {
      key: 'admin.users',
      portal: 'admin',
      label: 'Users',
      route: '/admin/users',
      icon: 'users',
      order: 110,
      group: 'People',
      permission: 'users:read',
    },
  ],
  flags: [],
  settingsSections: [],
  events: { publishes: ['user.created', 'user.deactivated', 'user.roles_changed'], subscribes: [] },
  dependsOn: ['auth', 'rbac'],
});
