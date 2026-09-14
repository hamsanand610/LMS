import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

export const questionsManifest = defineModule({
  key: 'questions',
  name: 'Question bank',
  version: '0.4.0',
  core: false,
  permissions: permissionsForModule('questions'),
  navigation: [
    {
      key: 'admin.questions',
      portal: 'admin',
      label: 'Question bank',
      route: '/admin/question-bank',
      icon: 'clipboard-list',
      order: 250,
      group: 'Assessment',
      permission: 'questions:manage',
    },
    {
      key: 'trainer.questions',
      portal: 'trainer',
      label: 'Question bank',
      route: '/trainer/question-bank',
      icon: 'clipboard-list',
      order: 140,
      permission: 'questions:create_own',
    },
  ],
  flags: [],
  settingsSections: [],
  events: {
    publishes: ['question.published', 'question.retired'],
    subscribes: [],
  },
  dependsOn: ['auth', 'rbac', 'settings'],
});
