import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

export const attendanceManifest = defineModule({
  key: 'attendance',
  name: 'Attendance',
  version: '0.1.0',
  core: false,
  permissions: permissionsForModule('attendance'),
  navigation: [
    {
      key: 'admin.attendance',
      portal: 'admin',
      label: 'Attendance',
      route: '/admin/attendance',
      icon: 'clipboard-check',
      order: 250,
      group: 'Learning',
      permission: 'attendance:manage',
    },
    {
      key: 'trainer.attendance',
      portal: 'trainer',
      label: 'Attendance',
      route: '/trainer/attendance',
      icon: 'clipboard-check',
      order: 120,
      permission: 'attendance:mark',
    },
  ],
  flags: [],
  settingsSections: [],
  events: {
    publishes: ['attendance.marked'],
    subscribes: [],
  },
  dependsOn: ['auth', 'rbac', 'batches', 'sessions', 'settings', 'notifications'],
});
