import { PortalShell } from '@/shell/portal-shell';
import { requirePortal } from '@/shell/portal-guard';

export default async function TrainerLayout({ children }: { children: React.ReactNode }) {
  const me = await requirePortal('trainer', '/trainer');
  return (
    <PortalShell me={me} portal="trainer">
      {children}
    </PortalShell>
  );
}
