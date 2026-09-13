import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

export const studentsManifest = defineModule({
  key: 'students',
  name: 'Students',
  version: '0.2.0',
  core: false,
  permissions: permissionsForModule('students'),
  navigation: [
    {
      key: 'admin.students',
      portal: 'admin',
      label: 'Students',
      route: '/admin/students',
      icon: 'graduation-cap',
      order: 120,
      group: 'People',
      permission: 'students:manage',
    },
  ],
  flags: [],
  settingsSections: [],
  events: {
    publishes: ['student.created', 'student.status_changed', 'student.document_reviewed'],
    subscribes: [],
  },
  dependsOn: ['auth', 'rbac', 'users', 'files'],
});
