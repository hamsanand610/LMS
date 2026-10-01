'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

/*
 * Navigation preferences, remembered per browser (plan §15.2). The collapsed rail is also stamped
 * on <html data-nav> before first paint by ThemeScript, so CSS sizes the first frame correctly and
 * these hooks only drive what CSS cannot (tooltips, the toggle's label).
 */

const NAV_KEY = 'lms.nav';
const GROUPS_KEY = 'lms.nav.groups';
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

const readCollapsed = (): boolean =>
  document.documentElement.getAttribute('data-nav') === 'collapsed';

/** Whether the desktop rail shows icons only. */
export function useNavCollapsed(): [boolean, (next: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const set = useCallback((next: boolean) => {
    const root = document.documentElement;
    if (next) root.setAttribute('data-nav', 'collapsed');
    else root.removeAttribute('data-nav');
    try {
      if (next) localStorage.setItem(NAV_KEY, 'collapsed');
      else localStorage.removeItem(NAV_KEY);
    } catch {
      // Storage unavailable: the choice still holds for this page view.
    }
    emit();
  }, []);
  return [collapsed, set];
}

function readGroups(): string {
  try {
    return localStorage.getItem(GROUPS_KEY) ?? '[]';
  } catch {
    return '[]';
  }
}

function parseGroups(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** Navigation groups the person has folded away (the group holding the current page never folds). */
export function useCollapsedGroups(): [
  ReadonlySet<string>,
  (group: string, collapsed: boolean) => void,
] {
  const raw = useSyncExternalStore(subscribe, readGroups, () => '[]');
  const groups = useMemo(() => new Set(parseGroups(raw)), [raw]);
  const set = useCallback((group: string, collapsed: boolean) => {
    const next = new Set(parseGroups(readGroups()));
    if (collapsed) next.add(group);
    else next.delete(group);
    try {
      localStorage.setItem(GROUPS_KEY, JSON.stringify([...next]));
    } catch {
      // Storage unavailable: nothing to remember.
    }
    emit();
  }, []);
  return [groups, set];
}
