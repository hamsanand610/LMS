import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

export const progressManifest = defineModule({
  key: 'progress',
  name: 'Progress',
  version: '0.3.0',
  core: false,
  permissions: permissionsForModule('progress'),
  navigation: [
    {
      key: 'student.progress',
      portal: 'student',
      label: 'Progress',
      route: '/progress',
      icon: 'trending-up',
      order: 140,
      group: 'Grow',
      permission: 'progress:read',
    },
  ],
  flags: [],
  settingsSections: [],
  events: {
    publishes: ['course.completed', 'enrolments.changed'],
    subscribes: ['course.published', 'batch.members_changed'],
  },
  dependsOn: [
    'auth',
    'rbac',
    'students',
    'batches',
    'sessions',
    'notifications',
    'assignments',
    'tests',
  ],
});
