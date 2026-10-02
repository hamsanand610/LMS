import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

/**
 * Feedback (F-18, Phases 3–4 D10): an administrator gives a form to a batch, once or every week;
 * its learners answer, anonymously unless the form says otherwise; the trainer it is about sees
 * the figures once five have answered. Off in the template; switched on by a client that wants it.
 */
export const feedbackManifest = defineModule({
  key: 'feedback',
  name: 'Feedback',
  version: '0.1.0',
  core: false,
  permissions: permissionsForModule('feedback'),
  navigation: [
    {
      key: 'student.feedback',
      portal: 'student',
      label: 'Feedback',
      route: '/feedback',
      icon: 'message-square-heart',
      order: 116,
      group: 'Learn',
      permission: 'feedback:respond',
    },
    {
      key: 'trainer.feedback',
      portal: 'trainer',
      label: 'Feedback',
      route: '/trainer/feedback',
      icon: 'message-square-heart',
      order: 265,
      group: 'Insight',
      permission: 'feedback:read',
    },
    {
      key: 'admin.feedback',
      portal: 'admin',
      label: 'Feedback',
      route: '/admin/feedback',
      icon: 'message-square-heart',
      order: 294,
      group: 'Engagement',
      permission: 'feedback:manage',
    },
  ],
  flags: [
    {
      key: 'module.feedback',
      description: 'Feedback forms to batches, answered anonymously; figures for trainers',
      default: false,
      kind: 'module',
    },
  ],
  settingsSections: [],
  events: { publishes: [], subscribes: [] },
  dependsOn: ['auth', 'rbac', 'batches', 'trainers', 'courses', 'notifications'],
});
