import { defineModule } from '@lms/module-sdk';
import {
  academicSettingsSchema,
  FOUNDATION_PERMISSIONS,
  generalSettingsSchema,
  legalSettingsSchema,
} from '@lms/shared';

export const settingsManifest = defineModule({
  key: 'settings',
  name: 'Settings and branding',
  version: '0.1.0',
  core: true,
  permissions: FOUNDATION_PERMISSIONS.filter((p) => p.moduleKey === 'settings'),
  navigation: [
    {
      key: 'admin.settings.general',
      portal: 'admin',
      label: 'General',
      route: '/admin/settings/general',
      icon: 'settings',
      order: 900,
      group: 'Settings',
      permission: 'settings:read',
    },
    {
      key: 'admin.settings.branding',
      portal: 'admin',
      label: 'Branding',
      route: '/admin/settings/branding',
      icon: 'palette',
      order: 910,
      group: 'Settings',
      permission: 'branding:manage',
    },
    {
      key: 'admin.settings.flags',
      portal: 'admin',
      label: 'Feature flags',
      route: '/admin/settings/feature-flags',
      icon: 'toggle-left',
      order: 920,
      group: 'Settings',
      permission: 'flags:manage',
    },
    {
      key: 'admin.settings.navigation',
      portal: 'admin',
      label: 'Navigation',
      route: '/admin/settings/navigation',
      icon: 'list-tree',
      order: 940,
      group: 'Settings',
      permission: 'settings:manage',
    },
  ],
  flags: [],
  settingsSections: [
    {
      key: 'general',
      title: 'General',
      schema: generalSettingsSchema,
      permission: 'settings:manage',
    },
    {
      key: 'academic',
      title: 'Academic defaults',
      schema: academicSettingsSchema,
      permission: 'settings:manage',
    },
    {
      key: 'legal',
      title: 'Legal and consent',
      schema: legalSettingsSchema,
      permission: 'settings:manage',
    },
  ],
  events: {
    publishes: ['settings.changed', 'branding.changed', 'flag.changed', 'navigation.changed'],
    subscribes: [],
  },
  dependsOn: [],
});
