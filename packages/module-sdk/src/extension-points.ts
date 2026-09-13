import type { NavigationItem, Portal } from '@lms/shared';

/**
 * Extension points a client overlay (or another module) can implement.
 * Each is a small typed interface; the registry collects implementations and the
 * owning module calls them at the documented moment.
 */

/** Transform the effective navigation of a portal for a user (after permissions and flags). */
export interface NavigationTransform {
  key: string;
  transform(
    portal: Portal,
    items: NavigationItem[],
    context: { roleKeys: string[] },
  ): NavigationItem[];
}

/** Run after a successful sign-in (e.g. sync with an external system). Must not throw. */
export interface PostLoginHook {
  key: string;
  onLogin(context: { userId: string; roleKeys: string[]; ip: string | null }): Promise<void> | void;
}

/** Contribute dashboard widgets for a portal (rendered by the web app by widget key). */
export interface DashboardWidgetProvider {
  key: string;
  widgets(portal: Portal): { key: string; order: number; permission?: string }[];
}

export interface ExtensionRegistry {
  navigationTransforms: NavigationTransform[];
  postLoginHooks: PostLoginHook[];
  dashboardWidgetProviders: DashboardWidgetProvider[];
}

export function createExtensionRegistry(): ExtensionRegistry {
  return { navigationTransforms: [], postLoginHooks: [], dashboardWidgetProviders: [] };
}
