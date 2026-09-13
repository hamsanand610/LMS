import { redirect } from 'next/navigation';
import { getMe } from '@/lib/api/server';
import { PortalShell } from '@/shell/portal-shell';

/** Account pages render inside the user's home portal shell. */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect('/login?next=%2Faccount');
  return (
    <PortalShell me={me} portal={me.homePortal}>
      {children}
    </PortalShell>
  );
}
