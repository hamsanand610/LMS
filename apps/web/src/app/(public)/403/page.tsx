import { ShieldX } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { StatusPage } from '@/components/status-page';
import { Button } from '@/components/ui/button';
import { getMe } from '@/lib/api/server';
import { portalHome } from '@/lib/auth/portals';

export const metadata: Metadata = { title: 'Access denied' };

/**
 * Where a wrong-role deep link lands (plan §15.2). It offers the way back to the portal this
 * person *does* have, rather than a generic home link that would leave them guessing.
 */
export default async function AccessDeniedPage() {
  const me = await getMe();
  const home = me && me.portals.length > 0 ? portalHome(me.homePortal) : '/';
  const label =
    me && me.portals.length > 0
      ? me.homePortal === 'student'
        ? 'Back to your dashboard'
        : `Back to the ${me.homePortal} portal`
      : 'Back to the sign-in page';

  return (
    <StatusPage
      code="403"
      label="Access denied"
      icon={ShieldX}
      title="You do not have access to this page"
      actions={
        <Button asChild>
          <Link href={home}>{label}</Link>
        </Button>
      }
    >
      Your account does not include this area. Ask an administrator if you think that is a mistake.
    </StatusPage>
  );
}
