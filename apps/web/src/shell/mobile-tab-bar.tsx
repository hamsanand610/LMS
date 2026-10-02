'use client';

import { Ellipsis, House, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavigationItem } from '@lms/shared';
import { cn } from '@/lib/utils';
import { iconFor } from './icons';
import { useNavDrawer } from './nav-drawer-context';
import { isActiveRoute } from './sidebar-nav';

/** The four destinations a learner uses most, in the plan's order (§15.1). */
const PREFERRED = ['/courses', '/labs', '/tests'];

/** A tab is a fifth of a phone's width: the words a tab can hold, where the menu's are longer. */
const SHORT_LABELS: Record<string, string> = {
  '/labs': 'Labs',
  '/interview-prep': 'Prep',
  '/leaderboard': 'Ranks',
};

interface Tab {
  key: string;
  label: string;
  route: string;
  icon: LucideIcon;
}

/**
 * The learner's tab bar on a phone (plan §15.2: "Students: bottom tabs (5) + More sheet"):
 * Home, Courses, Labs, Tests and More, which opens the full navigation. Built from the
 * learner's own navigation, so a module switched off never appears as a dead tab.
 */
export function MobileTabBar({
  items,
  home,
}: {
  items: NavigationItem[];
  home: { label: string; route: string };
}) {
  const pathname = usePathname();
  const { open, setOpen } = useNavDrawer();

  // Sitting a test, the paper's own controls take the bottom of the screen; a row of other
  // destinations there only invites leaving the paper by accident.
  if (/^\/tests\/[^/]+\/attempt/.test(pathname)) return null;

  const preferred = PREFERRED.map((route) => items.find((i) => i.route === route)).filter(
    (i): i is NavigationItem => Boolean(i),
  );
  const fill = items.filter((i) => !preferred.includes(i));
  const picked = [...preferred, ...fill].slice(0, 3);
  const tabs: Tab[] = [
    { key: 'home', label: 'Home', route: home.route, icon: House },
    ...picked.map((i) => ({
      key: i.key,
      label: SHORT_LABELS[i.route] ?? i.label,
      route: i.route,
      icon: iconFor(i.icon),
    })),
  ];
  const onTab = tabs.some((t) =>
    t.key === 'home' ? pathname === home.route : isActiveRoute(pathname, t.route, home.route),
  );

  const itemClass =
    'relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset';

  return (
    <nav
      aria-label="Sections"
      className="glass fixed inset-x-0 bottom-0 z-40 border-t border-(--glass-border) pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {tabs.map((tab) => {
          const active =
            tab.key === 'home'
              ? pathname === home.route
              : isActiveRoute(pathname, tab.route, home.route);
          const Icon = tab.icon;
          return (
            <li key={tab.key}>
              <Link
                href={tab.route}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  itemClass,
                  active ? 'text-brand' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-0 h-[3px] w-8 rounded-b-full bg-primary transition-opacity',
                    active ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <Icon className="size-5" aria-hidden="true" />
                <span className="max-w-full truncate px-1">{tab.label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={cn(
              itemClass,
              'w-full',
              !onTab ? 'text-brand' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Ellipsis className="size-5" aria-hidden="true" />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
