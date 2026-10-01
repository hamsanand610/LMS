import type { MeResponse, Portal } from '@lms/shared';
import { portalHome } from '@/lib/auth/portals';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { MeProvider } from './me-context';
import { MobileNav } from './mobile-nav';
import { MobileTabBar } from './mobile-tab-bar';
import { NavDrawerProvider } from './nav-drawer-context';
import { PageTransition } from './page-transition';

const PORTAL_LABEL: Record<Portal, string> = {
  admin: 'Admin',
  trainer: 'Trainer',
  student: 'Student',
};

/**
 * Application shell shared by all portals (plan §16.2): the ink navigation rail, sticky to the
 * viewport while the page scrolls beside it; a translucent sticky header; the page, capped at a
 * readable width; and on phones the drawer, plus the learner's tab bar.
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
  const portalLabel = `${PORTAL_LABEL[portal]} portal`;
  const learner = portal === 'student';

  return (
    <MeProvider me={me}>
      <NavDrawerProvider>
        <a
          href="#main-content"
          className="fixed top-3 left-3 z-[60] -translate-y-20 rounded-lg bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-lg ring-1 ring-border transition-transform focus:translate-y-0"
        >
          Skip to main content
        </a>
        <div className="flex min-h-dvh">
          <AppSidebar items={items} home={home} branding={me.branding} portalLabel={portalLabel} />
          <div className="flex min-w-0 flex-1 flex-col">
            <AppHeader items={items} home={home} branding={me.branding} portal={portal} />
            <main
              id="main-content"
              tabIndex={-1}
              className={
                learner
                  ? 'flex-1 px-4 pt-6 pb-28 outline-none sm:px-6 lg:px-8 lg:pt-8 lg:pb-12'
                  : 'flex-1 px-4 pt-6 pb-12 outline-none sm:px-6 lg:px-8 lg:pt-8'
              }
            >
              <div className="mx-auto w-full max-w-(--content-max)">
                <PageTransition>{children}</PageTransition>
              </div>
            </main>
          </div>
        </div>
        <MobileNav items={items} home={home} branding={me.branding} portalLabel={portalLabel} />
        {learner ? <MobileTabBar items={items} home={home} /> : null}
      </NavDrawerProvider>
    </MeProvider>
  );
}
