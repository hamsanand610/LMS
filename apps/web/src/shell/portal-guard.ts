import 'server-only';
import { redirect } from 'next/navigation';
import type { MeResponse, Portal } from '@lms/shared';
import { getMe } from '@/lib/api/server';

/**
 * Server-side guard for portal layouts.
 *
 * Unauthenticated → the sign-in page, carrying where they were going. Signed in but without this
 * portal → 403, which then offers the way back to their own (plan §15.2: "wrong-role deep link →
 * 403 with link to own portal"). Redirecting them quietly instead would hide that they asked for
 * something they are not allowed, which is worse for them and worse for anybody reading the logs.
 */
export async function requirePortal(portal: Portal, currentPath: string): Promise<MeResponse> {
  const me = await getMe();
  if (!me) redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  if (!me.portals.includes(portal)) redirect('/403');
  return me;
}
