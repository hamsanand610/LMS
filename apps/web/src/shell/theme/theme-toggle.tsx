'use client';

import { Moon, Sun, SunMoon } from 'lucide-react';
import { useSyncExternalStore } from 'react';

type Mode = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'lms.theme';
const ORDER: Mode[] = ['system', 'light', 'dark'];
const listeners = new Set<() => void>();

function resolve(mode: Mode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** The stored choice is the external source of truth; ThemeScript applies it before first paint. */
function readMode(): Mode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function writeMode(value: Mode): void {
  try {
    if (value === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // storage unavailable: the attribute still changes for this page view
  }
  document.documentElement.setAttribute('data-theme', resolve(value));
  for (const listener of listeners) listener();
}

/** Cycles system → light → dark; the choice is remembered per browser. */
export function ThemeToggle({ className }: { className?: string }) {
  const mode = useSyncExternalStore(subscribe, readMode, () => 'system' as Mode);
  const next = (): void => writeMode(ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length] ?? 'system');

  const Icon = mode === 'dark' ? Moon : mode === 'light' ? Sun : SunMoon;
  const label = mode === 'dark' ? 'Dark theme' : mode === 'light' ? 'Light theme' : 'System theme';
  return (
    <button
      type="button"
      onClick={next}
      aria-label={`${label} (click to change)`}
      title={label}
      className={
        className ??
        'inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground'
      }
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
