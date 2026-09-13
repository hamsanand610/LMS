import { PortalShell } from '@/shell/portal-shell';
import { requirePortal } from '@/shell/portal-guard';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const me = await requirePortal('student', '/dashboard');
  return (
    <PortalShell me={me} portal="student">
      {children}
    </PortalShell>
  );
}
