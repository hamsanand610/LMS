import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

export const batchesManifest = defineModule({
  key: 'batches',
  name: 'Programmes and batches',
  version: '0.2.0',
  core: false,
  permissions: permissionsForModule('batches'),
  navigation: [
    {
      key: 'admin.programs',
      portal: 'admin',
      label: 'Programmes',
      route: '/admin/programs',
      icon: 'library',
      order: 210,
      group: 'Learning',
      permission: 'programs:manage',
    },
    {
      key: 'admin.batches',
      portal: 'admin',
      label: 'Batches',
      route: '/admin/batches',
      icon: 'layers',
      order: 220,
      group: 'Learning',
      permission: 'batches:manage',
    },
    {
      key: 'trainer.batches',
      portal: 'trainer',
      label: 'My batches',
      route: '/trainer/batches',
      icon: 'layers',
      order: 170,
      group: 'Learners',
      permission: 'batches:read',
    },
  ],
  flags: [],
  settingsSections: [],
  events: {
    publishes: ['batch.created', 'batch.status_changed', 'batch.members_changed'],
    subscribes: [],
  },
  dependsOn: ['auth', 'rbac', 'students', 'trainers', 'notifications'],
});
