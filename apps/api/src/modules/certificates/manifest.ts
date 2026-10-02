import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

/**
 * Certificates of course completion (ADR-0022): issued automatically when a course is completed,
 * downloaded as a PDF, confirmed on a public page by their code. Off by default, as every optional
 * module is (operating rule 35).
 */
export const certificatesManifest = defineModule({
  key: 'certificates',
  name: 'Certificates',
  version: '0.1.0',
  core: false,
  permissions: permissionsForModule('certificates'),
  navigation: [
    {
      key: 'student.certificates',
      portal: 'student',
      label: 'Certificates',
      route: '/certificates',
      icon: 'award',
      order: 141,
      group: 'Grow',
      permission: 'certificates:read',
    },
    {
      key: 'trainer.certificates',
      portal: 'trainer',
      label: 'Certificates',
      route: '/trainer/certificates',
      icon: 'award',
      order: 268,
      group: 'Insight',
      permission: 'certificates:read',
      minScope: 'batch',
    },
    {
      key: 'admin.certificates',
      portal: 'admin',
      label: 'Certificates',
      route: '/admin/certificates',
      icon: 'award',
      order: 296,
      group: 'Engagement',
      permission: 'certificates:read',
      minScope: 'all',
    },
  ],
  flags: [
    {
      key: 'module.certificates',
      description:
        'Certificates of course completion, issued automatically, with a public verification page',
      default: false,
      kind: 'module',
    },
  ],
  settingsSections: [],
  events: { publishes: ['certificate.issued'], subscribes: ['course.completed'] },
  dependsOn: ['auth', 'rbac', 'courses', 'progress', 'notifications'],
});
