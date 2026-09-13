import type { MeResponse, Portal } from '@lms/shared';
import { publicEnv } from '@/lib/env';
import { portalHome } from '@/lib/auth/portals';
import { BrandLogo } from './brand-logo';
import { MeProvider } from './me-context';
import { MobileNav } from './mobile-nav';
import { SidebarNav } from './sidebar-nav';
import { ThemeToggle } from './theme/theme-toggle';
import { UserMenu } from './user-menu';

const PORTAL_LABEL: Record<Portal, string> = {
  admin: 'Admin',
  trainer: 'Trainer',
  student: 'Student',
};

/**
 * Application shell shared by all portals: branded sidebar with the user's effective navigation,
 * utility bar, environment banner outside production, and the page content.
 */
export function PortalShell({
  me,
  portal,
  children,
}: {
  me: MeResponse;
  portal: Portal;
  children: React.ReactNode;
}) {
  const items = me.navigation[portal];
  const home = { label: 'Dashboard', route: portalHome(portal) };
  return (
    <MeProvider me={me}>
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex">
          <div className="flex h-14 items-center gap-2 border-b border-border px-4">
            <BrandLogo branding={me.branding} size="sm" />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <SidebarNav items={items} home={home} />
          </div>
          <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
            {PORTAL_LABEL[portal]} portal
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          {publicEnv.appEnv !== 'production' ? (
            <div className="bg-warning-soft px-4 py-1 text-center text-xs font-medium text-warning">
              {publicEnv.appEnv === 'local' ? 'Local development' : 'Staging'} environment — demo
              data only
            </div>
          ) : null}
          <header className="flex h-14 items-center gap-2 border-b border-border bg-surface px-4">
            <MobileNav items={items} home={home} branding={me.branding} />
            <div className="min-w-0 flex-1 truncate text-sm text-muted-foreground lg:hidden">
              {me.branding.brandName}
            </div>
            <div className="hidden flex-1 lg:block" />
            <ThemeToggle />
            <UserMenu />
          </header>
          <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </MeProvider>
  );
}
