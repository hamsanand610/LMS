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
      // Roadmap Phase 2 (LRN-05): the learner's own attendance, class by class.
      key: 'student.attendance',
      portal: 'student',
      label: 'Attendance',
      route: '/attendance',
      icon: 'calendar-check',
      order: 113,
      group: 'Learn',
      permission: 'attendance:read',
    },
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
      group: 'Teach',
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
