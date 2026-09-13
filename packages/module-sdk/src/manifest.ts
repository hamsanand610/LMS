import type { NavigationItemDefinition, PermissionDefinition } from '@lms/shared';
import type { ZodType } from 'zod';

export interface FlagDefinition {
  key: string;
  description: string;
  default: boolean;
  kind: 'module' | 'option';
  /** Locked flags cannot be toggled in the UI (core modules). */
  locked?: boolean;
}

export interface SettingsSectionDefinition {
  key: string;
  title: string;
  schema: ZodType;
  /** Permission needed to edit the section. */
  permission: string;
}

export interface EventDefinitions {
  publishes: readonly string[];
  subscribes: readonly string[];
}

/**
 * Manifest every module ships. The registry reads it at boot to register permissions,
 * navigation, flags, settings sections and events. Disabled modules contribute nothing.
 */
export interface ModuleManifest {
  key: string;
  name: string;
  version: string;
  /** Core modules are always enabled and cannot be disabled by flags. */
  core?: boolean;
  permissions: readonly PermissionDefinition[];
  navigation: readonly NavigationItemDefinition[];
  flags: readonly FlagDefinition[];
  settingsSections: readonly SettingsSectionDefinition[];
  events: EventDefinitions;
  /** Keys of modules this module depends on (must be enabled). */
  dependsOn: readonly string[];
}

export function defineModule(manifest: ModuleManifest): ModuleManifest {
  if (!/^[a-z][a-z0-9-]*$/.test(manifest.key)) {
    throw new Error(`Module key "${manifest.key}" must be lowercase (a-z, 0-9, -)`);
  }
  for (const p of manifest.permissions) {
    if (p.moduleKey !== manifest.key) {
      throw new Error(
        `Permission ${p.key} declares moduleKey ${p.moduleKey} but lives in module ${manifest.key}`,
      );
    }
  }
  return manifest;
}
