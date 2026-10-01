'use client';

import { useSyncExternalStore } from 'react';

const MINUTE = 60_000;

function subscribe(onChange: () => void): () => void {
  const id = setInterval(onChange, MINUTE);
  return () => clearInterval(id);
}

/** Rounded to the minute so repeated reads within a minute return the same value. */
const readNow = (): number => Math.floor(Date.now() / MINUTE) * MINUTE;

/**
 * The current minute on the client, and null while rendering on the server. Anything relative to
 * "now" ("due tomorrow", "in 20 minutes") renders its absolute form first and switches after
 * hydration, so the server's text and the browser's can never disagree.
 */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, readNow, () => null);
}
