import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

export const practiceManifest = defineModule({
  key: 'practice',
  name: 'Coding practice',
  version: '0.4.0',
  core: false,
  permissions: permissionsForModule('practice'),
  navigation: [
    {
      key: 'student.practice',
      portal: 'student',
      label: 'Coding practice',
      route: '/practice',
      icon: 'code',
      order: 124,
      group: 'Practise',
      permission: 'practice:use',
    },
  ],
  flags: [],
  settingsSections: [],
  events: {
    publishes: ['execution.completed'],
    subscribes: [],
  },
  dependsOn: ['auth', 'rbac', 'questions'],
});
