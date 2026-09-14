import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

export const assignmentsManifest = defineModule({
  key: 'assignments',
  name: 'Assignments',
  version: '0.4.0',
  core: false,
  permissions: permissionsForModule('assignments'),
  navigation: [
    {
      key: 'admin.assignments',
      portal: 'admin',
      label: 'Assignments',
      route: '/admin/assignments',
      icon: 'clipboard-list',
      order: 260,
      group: 'Assessment',
      permission: 'assignments:manage',
    },
    {
      key: 'trainer.assignments',
      portal: 'trainer',
      label: 'Assignments',
      route: '/trainer/assignments',
      icon: 'clipboard-list',
      order: 150,
      permission: 'assignments:manage',
    },
    {
      key: 'student.assignments',
      portal: 'student',
      label: 'Assignments',
      route: '/assignments',
      icon: 'clipboard-list',
      order: 125,
      permission: 'assignments:read',
    },
  ],
  flags: [],
  settingsSections: [],
  events: {
    publishes: ['assignment.published', 'submission.created', 'submission.graded'],
    subscribes: [],
  },
  dependsOn: ['auth', 'rbac', 'questions', 'batches', 'notifications'],
});
