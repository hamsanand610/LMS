import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

/**
 * Doubts (ADR-0014): a learner asks about a course or a lesson and the trainers of their batch
 * answer in a thread. Off in the template; switched on by a client that wants it.
 */
export const doubtsManifest = defineModule({
  key: 'doubts',
  name: 'Doubts',
  version: '0.1.0',
  core: false,
  permissions: permissionsForModule('doubts'),
  navigation: [
    {
      key: 'student.doubts',
      portal: 'student',
      label: 'Doubts',
      route: '/doubts',
      icon: 'message-circle-question',
      order: 114,
      group: 'Learn',
      permission: 'doubts:ask',
    },
    {
      key: 'trainer.doubts',
      portal: 'trainer',
      label: 'Doubts',
      route: '/trainer/doubts',
      icon: 'message-circle-question',
      order: 135,
      group: 'Teach',
      permission: 'doubts:answer',
    },
    {
      key: 'admin.doubts',
      portal: 'admin',
      label: 'Doubts',
      route: '/admin/doubts',
      icon: 'message-circle-question',
      order: 290,
      group: 'Engagement',
      permission: 'doubts:answer',
      minScope: 'all',
    },
  ],
  flags: [
    {
      key: 'module.doubts',
      description: 'Learners ask doubts about courses and lessons; trainers answer',
      default: false,
      kind: 'module',
    },
  ],
  settingsSections: [],
  events: { publishes: [], subscribes: [] },
  dependsOn: ['auth', 'rbac', 'batches', 'courses', 'notifications'],
});
