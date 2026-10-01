'use client';

import { Bell, Menu, Search, UserRound, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { BrandingPublic, NavigationItem, Portal } from '@lms/shared';
import { BrandMark } from './brand-logo';
import { CommandPalette } from './command-palette';
import { iconFor } from './icons';
import { useNavDrawer } from './nav-drawer-context';
import { NotificationBell } from './notification-bell';
import { isActiveRoute } from './sidebar-nav';
import { ThemeToggle } from './theme/theme-toggle';
import { UserMenu } from './user-menu';

const ACCOUNT_SECTIONS: Array<{ prefix: string; label: string; icon: LucideIcon }> = [
  { prefix: '/settings/notifications', label: 'Notification preferences', icon: Bell },
  { prefix: '/notifications', label: 'Notifications', icon: Bell },
  { prefix: '/search', label: 'Search', icon: Search },
  { prefix: '/account', label: 'My account', icon: UserRound },
];

/** The section the current page belongs to: a navigation item, an account page, or home. */
function sectionFor(
  pathname: string,
  items: NavigationItem[],
  home: { label: string; route: string },
): { label: string; icon: LucideIcon } {
  const item = items.find((i) => isActiveRoute(pathname, i.route, home.route));
  if (item) return { label: item.label, icon: iconFor(item.icon) };
  const account = ACCOUNT_SECTIONS.find((s) => pathname.startsWith(s.prefix));
  if (account) return account;
  return { label: home.label, icon: iconFor('dashboard') };
}

/**
 * The top bar: sticky and translucent over the scrolling page (the one place glass is used on
 * every screen). On desktop it names the section you are in; on a phone it carries the brand and,
 * for staff, the menu button (learners have the tab bar's "More" instead, plan §15.2).
 */
export function AppHeader({
  items,
  home,
  branding,
  portal,
}: {
  items: NavigationItem[];
  home: { label: string; route: string };
  branding: BrandingPublic;
  portal: Portal;
}) {
  const pathname = usePathname();
  const { open, setOpen } = useNavDrawer();
  const section = sectionFor(pathname, items, home);
  const SectionIcon = section.icon;

  return (
    <header className="glass sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center gap-2 border-b border-(--glass-border) px-3 sm:px-6 lg:px-8">
      {portal !== 'student' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-haspopup="dialog"
          aria-expanded={open}
          className="inline-flex size-9 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-surface-2 hover:text-foreground lg:hidden"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      ) : null}

      <Link
        href={home.route}
        className="flex min-w-0 items-center gap-2.5 rounded-lg pr-1 lg:hidden"
      >
        <BrandMark branding={branding} size="sm" />
        <span className="truncate text-sm font-semibold tracking-tight">{branding.brandName}</span>
      </Link>

      <div className="hidden min-w-0 items-center gap-3 lg:flex">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground shadow-xs">
          <SectionIcon className="size-4" aria-hidden="true" />
        </span>
        <span className="truncate text-[14px] font-semibold tracking-[-0.005em] text-foreground">
          {section.label}
        </span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-0.5 sm:gap-1">
        <CommandPalette />
        <NotificationBell />
        <ThemeToggle className="hidden sm:inline-flex" />
        <div className="ml-1.5">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
