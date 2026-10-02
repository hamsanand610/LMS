import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

/**
 * Labs (ADR-0018): coding, SQL, debugging and web exercises from the question bank, run in the
 * sandbox (ADR-0016), and a free playground. The module keeps the key `practice`, so the permissions,
 * the run context and everything that counts practice solves stay as they were. Off unless an
 * institute switches it on (operating rule 35); SI Academy does.
 */
export const practiceManifest = defineModule({
  key: 'practice',
  name: 'Labs',
  version: '0.5.0',
  core: false,
  permissions: permissionsForModule('practice'),
  navigation: [
    {
      // The key predates the name; navigation overrides an institute saved still apply to it.
      key: 'student.practice',
      portal: 'student',
      label: 'Labs',
      route: '/labs',
      icon: 'flask',
      order: 124,
      group: 'Practise',
      permission: 'practice:use',
    },
    {
      key: 'trainer.labs',
      portal: 'trainer',
      label: 'Labs',
      route: '/trainer/labs',
      icon: 'flask',
      order: 164,
      group: 'Assess',
      permission: 'practice:publish_own',
    },
    {
      key: 'admin.labs',
      portal: 'admin',
      label: 'Labs',
      route: '/admin/labs',
      icon: 'flask',
      order: 252,
      group: 'Assessment',
      permission: 'practice:publish_own',
    },
  ],
  flags: [
    {
      key: 'module.practice',
      description: 'Labs: coding, SQL, web and debugging labs, and the code playground',
      default: false,
      kind: 'module',
    },
  ],
  settingsSections: [],
  events: {
    publishes: ['execution.completed'],
    subscribes: [],
  },
  dependsOn: ['auth', 'rbac', 'questions'],
});
