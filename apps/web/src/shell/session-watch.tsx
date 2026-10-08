'use client';

import { useEffect } from 'react';
import { watchSessionChanges } from '@/lib/auth/session-sync';

/**
 * Reloads this tab when another tab signs out or in as someone else, so a portal never goes on
 * showing one person's pages while acting as another (lib/auth/session-sync.ts).
 */
export function SessionWatch({ userId }: { userId: string }) {
  useEffect(() => watchSessionChanges(userId, () => window.location.reload()), [userId]);
  return null;
}
