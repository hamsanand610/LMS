import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

/**
 * Placement (ADR-0014): company interview-prep kits built from the practice catalogue, and a basic
 * drives board. Off in the template; a client that runs placements switches it on.
 */
export const placementManifest = defineModule({
  key: 'placement',
  name: 'Placement',
  version: '0.1.0',
  core: false,
  permissions: permissionsForModule('placement'),
  navigation: [
    {
      key: 'student.interview-prep',
      portal: 'student',
      label: 'Interview prep',
      route: '/interview-prep',
      icon: 'building-2',
      order: 126,
      group: 'Practise',
      permission: 'placements:read',
    },
    {
      key: 'student.placements',
      portal: 'student',
      label: 'Placements',
      route: '/placements',
      icon: 'briefcase',
      order: 144,
      group: 'Grow',
      permission: 'placements:read',
    },
    {
      key: 'admin.drives',
      portal: 'admin',
      label: 'Drives',
      route: '/admin/placements',
      icon: 'briefcase',
      order: 280,
      group: 'Placements',
      permission: 'placements:manage',
    },
    {
      key: 'admin.companies',
      portal: 'admin',
      label: 'Companies',
      route: '/admin/companies',
      icon: 'building-2',
      order: 285,
      group: 'Placements',
      permission: 'placements:manage',
    },
  ],
  flags: [
    {
      key: 'module.placement',
      description: 'Interview-prep kits by company and the placement drives board',
      default: false,
      kind: 'module',
    },
  ],
  settingsSections: [],
  events: { publishes: [], subscribes: [] },
  dependsOn: ['auth', 'rbac', 'batches', 'practice', 'attendance', 'notifications'],
});
