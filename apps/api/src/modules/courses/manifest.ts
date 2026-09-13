import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

export const coursesManifest = defineModule({
  key: 'courses',
  name: 'Courses',
  version: '0.3.0',
  core: false,
  permissions: permissionsForModule('courses'),
  navigation: [
    {
      key: 'admin.courses',
      portal: 'admin',
      label: 'Courses',
      route: '/admin/courses',
      icon: 'book-open',
      order: 230,
      group: 'Learning',
      permission: 'courses:manage',
    },
    {
      key: 'trainer.courses',
      portal: 'trainer',
      label: 'Courses',
      route: '/trainer/courses',
      icon: 'book-open',
      order: 130,
      permission: 'courses:read',
    },
    {
      key: 'student.courses',
      portal: 'student',
      label: 'Courses',
      route: '/courses',
      icon: 'book-open',
      order: 120,
      permission: 'courses:read',
    },
  ],
  flags: [],
  settingsSections: [],
  events: {
    publishes: ['course.published', 'course.unpublished', 'recording.attached'],
    subscribes: [],
  },
  dependsOn: ['auth', 'rbac', 'files', 'batches', 'progress', 'sessions'],
});
