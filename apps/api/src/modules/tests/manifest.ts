import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

export const testsManifest = defineModule({
  key: 'tests',
  name: 'Tests',
  version: '0.4.0',
  core: false,
  permissions: permissionsForModule('tests'),
  navigation: [
    {
      key: 'admin.tests',
      portal: 'admin',
      label: 'Tests',
      route: '/admin/tests',
      icon: 'file-text',
      order: 270,
      group: 'Assessment',
      permission: 'tests:manage',
    },
    {
      key: 'trainer.tests',
      portal: 'trainer',
      label: 'Tests',
      route: '/trainer/tests',
      icon: 'file-text',
      order: 160,
      group: 'Assess',
      permission: 'tests:manage',
    },
    {
      key: 'student.tests',
      portal: 'student',
      label: 'Tests',
      route: '/tests',
      icon: 'file-text',
      order: 122,
      group: 'Practise',
      permission: 'tests:read',
    },
  ],
  flags: [],
  settingsSections: [],
  events: {
    publishes: ['test.scheduled', 'attempt.submitted', 'test.released'],
    subscribes: [],
  },
  dependsOn: ['auth', 'rbac', 'questions', 'batches', 'notifications'],
});
