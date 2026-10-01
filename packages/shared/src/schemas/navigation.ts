import { z } from 'zod';
import type { PermissionScope } from '../permissions.js';
import { PORTALS } from '../constants.js';

/** A navigation item contributed by a module manifest, before client overrides. */
export interface NavigationItemDefinition {
  key: string;
  portal: (typeof PORTALS)[number];
  label: string;
  route: string;
  icon: string;
  order: number;
  /** Required permission key; omitted = visible to every signed-in user of the portal. */
  permission?: string;
  /**
   * The narrowest scope of `permission` that shows the item. A staff page reached through a
   * permission learners also hold (`leaderboard:read` at `own`) sets `batch` or `all` here.
   */
  minScope?: PermissionScope;
  /** Group heading in staff sidebars (e.g. "People", "Learning"). */
  group?: string;
  /** Flag key that must be enabled for the item to appear (defaults to the module flag). */
  flag?: string;
}

/** Client override for one navigation item (stored per portal). */
export const navigationOverrideSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().trim().min(1).max(40).optional(),
  order: z.number().int().min(0).max(1000).optional(),
  hidden: z.boolean().optional(),
  icon: z.string().max(40).optional(),
});
export type NavigationOverride = z.infer<typeof navigationOverrideSchema>;

export const navigationConfigSchema = z.object({
  portal: z.enum(PORTALS),
  items: z.array(navigationOverrideSchema).max(200),
});
export type NavigationConfig = z.infer<typeof navigationConfigSchema>;

/** Effective navigation item delivered to the web app (after permissions, flags and overrides). */
export interface NavigationItem {
  key: string;
  label: string;
  route: string;
  icon: string;
  order: number;
  group?: string;
}
