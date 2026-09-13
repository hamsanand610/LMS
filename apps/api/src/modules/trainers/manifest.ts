import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

export const trainersManifest = defineModule({
  key: 'trainers',
  name: 'Trainers',
  version: '0.2.0',
  core: false,
  permissions: permissionsForModule('trainers'),
  navigation: [
    {
      key: 'admin.trainers',
      portal: 'admin',
      label: 'Trainers',
      route: '/admin/trainers',
      icon: 'user-cog',
      order: 130,
      group: 'People',
      permission: 'trainers:manage',
    },
  ],
  flags: [],
  settingsSections: [],
  events: { publishes: ['trainer.created', 'trainer.updated'], subscribes: [] },
  dependsOn: ['auth', 'rbac', 'users'],
});
