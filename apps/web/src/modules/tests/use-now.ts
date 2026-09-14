'use client';

import { useSyncExternalStore } from 'react';

/**
 * A ticking clock as an external store rather than state written from an effect.
 *
 * The React Compiler rules this project runs under forbid setting state inside an effect, and a
 * countdown needs the current time every second. `useSyncExternalStore` is the shape that gives a
 * component a changing value from outside React without breaking that rule.
 */
const subscribers = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let snapshot = Date.now();

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  if (!timer) {
    timer = setInterval(() => {
      snapshot = Date.now();
      for (const notify of subscribers) notify();
    }, 1000);
  }
  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  return snapshot;
}

/** The server's time is the truth; this is only what the browser thinks, used to count down. */
function getServerSnapshot(): number {
  return snapshot;
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Formats a number of seconds as `mm:ss`, or `h:mm:ss` past an hour. */
export function formatRemaining(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
