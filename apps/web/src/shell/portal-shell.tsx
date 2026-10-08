import type { MeResponse, Portal } from '@lms/shared';
import { portalHome } from '@/lib/auth/portals';
import { canUseAi } from '@/modules/ai/access';
import { canUseAgent } from '@/modules/ai/agent';
import { AiAssistantProvider } from '@/modules/ai/assistant';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { MeProvider } from './me-context';
import { MobileNav } from './mobile-nav';
import { MobileTabBar } from './mobile-tab-bar';
import { NavDrawerProvider } from './nav-drawer-context';
import { PageTransition } from './page-transition';
import { SessionWatch } from './session-watch';

const PORTAL_LABEL: Record<Portal, string> = {
  admin: 'Admin',
  trainer: 'Trainer',
  student: 'Student',
};

/**
 * Application shell shared by all portals (plan §16.2): the ink navigation rail, sticky to the
 * viewport while the page scrolls beside it; a translucent sticky header; the page, capped at a
 * readable width; and on phones the drawer, plus the learner's tab bar. Where SI Academy AI is on
 * for the person, its launcher floats at the bottom right (Phase 7E), and the page keeps room
 * below its last line so the launcher never sits over it.
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
  const launcher = canUseAi(me, 'assistant') || canUseAi(me, 'workspace') || canUseAgent(me);
  const bottom = learner
    ? launcher
      ? 'pb-32 lg:pb-24'
      : 'pb-28 lg:pb-12'
    : launcher
      ? 'pb-24'
      : 'pb-12';

  return (
    <MeProvider me={me}>
      <SessionWatch userId={me.user.id} />
      <NavDrawerProvider>
        <AiAssistantProvider portal={portal}>
          <a
            href="#main-content"
            className="fixed top-3 left-3 z-[60] -translate-y-20 rounded-lg bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-lg ring-1 ring-border transition-transform focus:translate-y-0"
          >
            Skip to main content
          </a>
          <div className="flex min-h-dvh">
            <AppSidebar
              items={items}
              home={home}
              branding={me.branding}
              portalLabel={portalLabel}
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <AppHeader items={items} home={home} branding={me.branding} portal={portal} />
              <main
                id="main-content"
                tabIndex={-1}
                className={`flex-1 px-4 pt-6 outline-none sm:px-6 lg:px-8 lg:pt-8 ${bottom}`}
              >
                <div className="mx-auto w-full max-w-(--content-max)">
                  <PageTransition>{children}</PageTransition>
                </div>
              </main>
            </div>
          </div>
          <MobileNav items={items} home={home} branding={me.branding} portalLabel={portalLabel} />
          {learner ? <MobileTabBar items={items} home={home} /> : null}
        </AiAssistantProvider>
      </NavDrawerProvider>
    </MeProvider>
  );
}
