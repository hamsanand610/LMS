'use client';

import { Moon, Sun, SunMoon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ThemeMode, useThemeMode } from './theme-store';

const ORDER: ThemeMode[] = ['system', 'light', 'dark'];
const LABEL: Record<ThemeMode, string> = {
  system: 'System theme',
  light: 'Light theme',
  dark: 'Dark theme',
};

/** Cycles system → light → dark; the choice is remembered per browser. */
export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useThemeMode();
  const next = (): void => setMode(ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length] ?? 'system');
  const Icon = mode === 'dark' ? Moon : mode === 'light' ? Sun : SunMoon;
  return (
    <button
      type="button"
      onClick={next}
      aria-label={`${LABEL[mode]} (click to change)`}
      title={LABEL[mode]}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-surface-2 hover:text-foreground',
        className,
      )}
    >
      <Icon className="size-[18px]" aria-hidden="true" />
    </button>
  );
}

/** Three-way choice as a segmented control, for the account menu and the phone drawer. */
export function ThemeSegmented({ tone = 'default' }: { tone?: 'default' | 'onDark' }) {
  const [mode, setMode] = useThemeMode();
  const options: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
    { value: 'system', label: 'System', icon: SunMoon },
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        'grid grid-cols-3 gap-1 rounded-lg p-1',
        tone === 'onDark' ? 'bg-nav-hover' : 'bg-surface-2',
      )}
    >
      {options.map(({ value, label, icon: Icon }) => {
        const checked = mode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => setMode(value)}
            className={cn(
              'inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors',
              tone === 'onDark'
                ? checked
                  ? 'bg-nav-active text-nav-foreground shadow-sm'
                  : 'text-nav-muted hover:text-nav-foreground'
                : checked
                  ? 'bg-surface text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
