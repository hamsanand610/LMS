'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'lms.theme';
const listeners = new Set<() => void>();

function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** The stored choice is the source of truth; ThemeScript applies it before first paint. */
function readMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function readResolved(): 'light' | 'dark' {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
    media.removeEventListener('change', listener);
  };
}

function writeMode(value: ThemeMode): void {
  try {
    if (value === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage unavailable: the attribute still changes for this page view.
  }
  document.documentElement.setAttribute('data-theme', resolve(value));
  for (const listener of listeners) listener();
}

/** The person's theme choice (system, light or dark) and a setter shared by every control. */
export function useThemeMode(): [ThemeMode, (mode: ThemeMode) => void] {
  const mode = useSyncExternalStore(subscribe, readMode, () => 'system' as ThemeMode);
  const set = useCallback((next: ThemeMode) => writeMode(next), []);
  return [mode, set];
}

/** The theme actually on screen, for components that must match it (the toaster). */
export function useResolvedTheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribe, readResolved, () => 'light');
}
