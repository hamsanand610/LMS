import { PortalShell } from '@/shell/portal-shell';
import { requirePortal } from '@/shell/portal-guard';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requirePortal('admin', '/admin');
  return (
    <PortalShell me={me} portal="admin">
      {children}
    </PortalShell>
  );
}
