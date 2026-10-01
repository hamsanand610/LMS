import { defineModule } from '@lms/module-sdk';
import { permissionsForModule } from '@lms/shared';

/**
 * The points leaderboard (ADR-0014). Off in the template — plan §16 keeps ranks off by default —
 * and switched on by a client that wants it.
 */
export const gamificationManifest = defineModule({
  key: 'gamification',
  name: 'Leaderboard',
  version: '0.1.0',
  core: false,
  permissions: permissionsForModule('gamification'),
  navigation: [
    {
      key: 'student.leaderboard',
      portal: 'student',
      label: 'Leaderboard',
      route: '/leaderboard',
      icon: 'trophy',
      order: 142,
      group: 'Grow',
      permission: 'leaderboard:read',
    },
    {
      key: 'trainer.leaderboard',
      portal: 'trainer',
      label: 'Leaderboard',
      route: '/trainer/leaderboard',
      icon: 'trophy',
      order: 175,
      group: 'Learners',
      permission: 'leaderboard:read',
      minScope: 'batch',
    },
    {
      key: 'admin.leaderboard',
      portal: 'admin',
      label: 'Leaderboard',
      route: '/admin/leaderboard',
      icon: 'trophy',
      order: 294,
      group: 'Engagement',
      permission: 'leaderboard:read',
      minScope: 'all',
    },
  ],
  flags: [
    {
      key: 'module.gamification',
      description: 'Points leaderboard for learners and staff',
      default: false,
      kind: 'module',
    },
  ],
  settingsSections: [],
  events: { publishes: [], subscribes: [] },
  dependsOn: ['auth', 'rbac', 'batches', 'progress'],
});
