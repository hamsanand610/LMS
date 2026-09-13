import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

export const notificationsManifest = defineModule({
  key: 'notifications',
  name: 'Notifications',
  version: '0.2.0',
  core: true,
  permissions: permissionsForModule('notifications'),
  navigation: [
    {
      key: 'admin.announcements',
      portal: 'admin',
      label: 'Announcements',
      route: '/admin/announcements',
      icon: 'megaphone',
      order: 610,
      group: 'Operations',
      permission: 'announcements:manage',
    },
  ],
  flags: [],
  settingsSections: [],
  events: {
    publishes: ['notification.created', 'announcement.published'],
    subscribes: ['student.created', 'batch.status_changed'],
  },
  dependsOn: ['auth'],
});
