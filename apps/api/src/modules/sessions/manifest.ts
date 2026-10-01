import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

export const sessionsManifest = defineModule({
  key: 'sessions',
  name: 'Schedule',
  version: '0.3.0',
  core: false,
  permissions: permissionsForModule('sessions'),
  navigation: [
    {
      key: 'admin.schedule',
      portal: 'admin',
      label: 'Schedule',
      route: '/admin/schedule',
      icon: 'calendar-days',
      order: 240,
      group: 'Learning',
      permission: 'sessions:manage',
    },
    {
      key: 'trainer.schedule',
      portal: 'trainer',
      label: 'Schedule',
      route: '/trainer/schedule',
      icon: 'calendar-days',
      order: 110,
      group: 'Teach',
      permission: 'sessions:read',
    },
    {
      key: 'student.schedule',
      portal: 'student',
      label: 'Schedule',
      route: '/schedule',
      icon: 'calendar-days',
      order: 112,
      group: 'Learn',
      permission: 'sessions:read',
    },
  ],
  flags: [],
  settingsSections: [],
  events: {
    publishes: ['session.created', 'session.updated', 'session.cancelled'],
    subscribes: [],
  },
  dependsOn: ['auth', 'rbac', 'batches', 'trainers', 'notifications'],
});
