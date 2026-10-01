'use client';

import { LogOut, X } from 'lucide-react';
import type { BrandingPublic, NavigationItem } from '@lms/shared';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { BrandMark } from './brand-logo';
import { useMe } from './me-context';
import { useNavDrawer } from './nav-drawer-context';
import { SidebarNav } from './sidebar-nav';
import { ThemeSegmented } from './theme/theme-toggle';
import { initials } from './user-menu';
import { useSignOut } from './use-sign-out';

/**
 * The navigation drawer below the desktop breakpoint: the same ink plane and the same grouped
 * list as the rail, plus the account essentials a phone header has no room for. Radix traps focus,
 * closes on Escape, locks the page behind it and returns focus to whatever opened it.
 */
export function MobileNav({
  items,
  home,
  branding,
  portalLabel,
}: {
  items: NavigationItem[];
  home: { label: string; route: string };
  branding: BrandingPublic;
  portalLabel: string;
}) {
  const { open, setOpen } = useNavDrawer();
  const me = useMe();
  const signOut = useSignOut();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        data-nav-plane=""
        showCloseButton={false}
        className="w-[min(20rem,86vw)] gap-0 border-nav-border bg-nav p-0 text-nav-foreground data-[side=left]:w-[min(20rem,86vw)] data-[side=left]:duration-300 data-[side=left]:data-open:slide-in-from-left data-[side=left]:data-closed:slide-out-to-left sm:max-w-xs lg:hidden"
      >
        <SheetHeader className="flex-row items-center justify-between gap-3 border-b border-nav-border px-4 py-3">
          <SheetTitle className="flex min-w-0 items-center gap-3 text-nav-foreground">
            <BrandMark branding={branding} />
            <span className="flex min-w-0 flex-col text-left leading-tight">
              <span className="truncate text-sm font-semibold">{branding.brandName}</span>
              <span className="truncate text-[11px] font-medium tracking-[0.06em] text-nav-muted uppercase">
                {portalLabel}
              </span>
            </span>
          </SheetTitle>
          <SheetClose
            aria-label="Close navigation"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-nav-muted transition-colors outline-none hover:bg-nav-hover hover:text-nav-foreground focus-visible:ring-2 focus-visible:ring-focus"
          >
            <X className="size-5" aria-hidden="true" />
          </SheetClose>
        </SheetHeader>
        <SheetDescription className="sr-only">
          Every section you can open, grouped as in the sidebar.
        </SheetDescription>

        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          <SidebarNav
            items={items}
            home={home}
            variant="drawer"
            onNavigate={() => setOpen(false)}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-nav-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-nav-active text-xs font-semibold text-nav-accent"
            >
              {initials(me.user.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{me.user.name}</p>
              <p className="truncate text-xs text-nav-muted">{me.user.email}</p>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-nav-muted transition-colors outline-none hover:bg-nav-hover hover:text-nav-foreground focus-visible:ring-2 focus-visible:ring-focus"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
          <ThemeSegmented tone="onDark" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
