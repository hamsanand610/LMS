import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

export const profileManifest = defineModule({
  key: 'profile',
  name: 'Profile',
  version: '0.1.0',
  core: false,
  permissions: permissionsForModule('profile'),
  navigation: [
    {
      key: 'student.profile',
      portal: 'student',
      label: 'Profile',
      route: '/profile',
      icon: 'user',
      order: 200,
      permission: 'profile:read',
    },
  ],
  flags: [],
  settingsSections: [],
  events: { publishes: [], subscribes: [] },
  dependsOn: ['auth', 'rbac', 'students', 'files'],
});
