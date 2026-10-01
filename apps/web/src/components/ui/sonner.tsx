'use client';

import { useSyncExternalStore } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from 'lucide-react';
import { useResolvedTheme } from '@/shell/theme/theme-store';

const DESKTOP = '(min-width: 1024px)';

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (listener) => {
      const media = window.matchMedia(DESKTOP);
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => true,
  );
}

/**
 * Toasts follow the theme actually on screen (the app stamps data-theme itself; it does not use
 * next-themes) and the design tokens rather than the library's own colours. Bottom-right on
 * desktop, top on a phone so they never sit on the learner's tab bar (plan §16.5).
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useResolvedTheme();
  const desktop = useIsDesktop();

  return (
    <Sonner
      theme={theme}
      position={desktop ? 'bottom-right' : 'top-center'}
      visibleToasts={3}
      duration={5000}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--surface-elevated)',
          '--normal-text': 'var(--text)',
          '--normal-border': 'var(--border)',
          '--success-bg': 'var(--success-soft)',
          '--success-text': 'var(--success)',
          '--success-border': 'color-mix(in oklab, var(--success) 25%, transparent)',
          '--error-bg': 'var(--danger-soft)',
          '--error-text': 'var(--danger)',
          '--error-border': 'color-mix(in oklab, var(--danger) 25%, transparent)',
          '--warning-bg': 'var(--warning-soft)',
          '--warning-text': 'var(--warning)',
          '--warning-border': 'color-mix(in oklab, var(--warning) 25%, transparent)',
          '--info-bg': 'var(--info-soft)',
          '--info-text': 'var(--info)',
          '--info-border': 'color-mix(in oklab, var(--info) 25%, transparent)',
          '--border-radius': 'calc(var(--radius) * 1.5)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'cn-toast shadow-lg',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
