import 'server-only';
import { redirect } from 'next/navigation';
import type { MeResponse, Portal } from '@lms/shared';
import { getMe } from '@/lib/api/server';
import { portalHome } from '@/lib/auth/portals';

/**
 * Server-side guard for portal layouts: unauthenticated → login (with return path);
 * authenticated but without access to this portal → the user's own portal or 403.
 */
export async function requirePortal(portal: Portal, currentPath: string): Promise<MeResponse> {
  const me = await getMe();
  if (!me) redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  if (!me.portals.includes(portal)) {
    redirect(me.portals.length ? portalHome(me.homePortal) : '/403');
  }
  return me;
}
