import { defineModule } from '@lms/module-sdk';

export const authManifest = defineModule({
  key: 'auth',
  name: 'Authentication',
  version: '0.1.0',
  core: true,
  permissions: [],
  navigation: [],
  flags: [],
  settingsSections: [],
  events: {
    publishes: ['user.logged_in', 'user.invitation_accepted', 'user.password_changed'],
    subscribes: [],
  },
  dependsOn: [],
});
