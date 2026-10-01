'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { api } from '@/lib/api/http';

/**
 * Ends the session and returns to the sign-in page, whether or not the API call succeeds. The
 * query cache goes with it: on a shared computer, the next person to sign in must not be shown
 * what the last one loaded.
 */
export function useSignOut(): () => Promise<void> {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST', noRefresh: true });
    } finally {
      queryClient.clear();
      router.replace('/login');
      router.refresh();
    }
  }, [queryClient, router]);
}
