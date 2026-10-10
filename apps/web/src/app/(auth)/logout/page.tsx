'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api } from '@/lib/api/http';
import { announceSessionChange } from '@/lib/auth/session-sync';
import { clearLocalDrafts } from '@/lib/drafts';

/** Signs out on arrival (linked from menus) and returns to the sign-in page. */
export default function LogoutPage() {
  const router = useRouter();
  useEffect(() => {
    // Unsent drafts stay with their writer, not with the browser (a lab PC is shared).
    clearLocalDrafts();
    api('/auth/logout', { method: 'POST', noRefresh: true })
      .catch(() => undefined)
      .finally(() => {
        // Other open tabs were acting as the person who just left: they reload to sign-in.
        announceSessionChange({ type: 'signed-out' });
        router.replace('/login');
        router.refresh();
      });
  }, [router]);
  return <p className="text-sm text-muted-foreground">Signing out…</p>;
}
