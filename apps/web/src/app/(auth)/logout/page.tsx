'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api } from '@/lib/api/http';

/** Signs out on arrival (linked from menus) and returns to the sign-in page. */
export default function LogoutPage() {
  const router = useRouter();
  useEffect(() => {
    api('/auth/logout', { method: 'POST', noRefresh: true })
      .catch(() => undefined)
      .finally(() => {
        router.replace('/login');
        router.refresh();
      });
  }, [router]);
  return <p className="text-sm text-muted-foreground">Signing out…</p>;
}
