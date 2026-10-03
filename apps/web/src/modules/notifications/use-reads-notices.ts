'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '@/lib/api/http';

/**
 * For a page that loads its subject from a list: tells the API it has been opened, so the
 * notices that lead to it (a test closing soon, a feedback form) are read and the bell agrees
 * (Phase 5). Pages that load their own subject have this done by the API itself.
 */
export function useReadsNotices(path: string): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    let cancelled = false;
    void api<{ marked: number }>('/me/notifications/read-page', {
      method: 'POST',
      body: { path },
    })
      .then((result) => {
        if (cancelled || result.marked === 0) return;
        void queryClient.invalidateQueries({ queryKey: ['notification-summary'] });
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      // Reading is a courtesy to the bell; a failure here never troubles the page.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [path, queryClient]);
}
