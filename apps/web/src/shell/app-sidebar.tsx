'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { BrandingPublic, NavigationItem } from '@lms/shared';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BrandLogo, BrandMark } from './brand-logo';
import { useNavCollapsed } from './nav-state';
import { SidebarNav } from './sidebar-nav';

/**
 * The desktop navigation rail: an ink plane in both themes, sticky to the viewport so it stays in
 * view however long the page, with its own scroll when the list is taller than the screen.
 * Collapses to icons (remembered); widths and label visibility are driven by CSS from
 * <html data-nav>, so the first frame is already right (globals.css).
 */
export function AppSidebar({
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
  const [collapsed, setCollapsed] = useNavCollapsed();
  const toggleLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside
      data-rail=""
      data-nav-plane=""
      aria-label="Sidebar"
      className="sticky top-0 z-40 hidden h-dvh w-(--nav-current) shrink-0 flex-col self-start border-r border-nav-border bg-nav text-nav-foreground transition-[width] duration-200 ease-out lg:flex"
    >
      {/* The rail's own light: the Burgundy Glow, once, behind the brand. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-56"
        style={{
          background:
            'radial-gradient(18rem 12rem at 0% 0%, color-mix(in oklab, var(--brand-primary) 26%, transparent), transparent 70%)',
        }}
      />
      <div
        className="relative flex h-(--header-height) shrink-0 items-center gap-3 border-b border-nav-border px-4"
        data-rail-brand=""
      >
        <BrandMark branding={branding} />
        <div data-nav-label="" className="flex min-w-0 flex-col leading-tight">
          <BrandLogo
            branding={branding}
            tone="onDark"
            size="sm"
            className="truncate text-[15px] tracking-[-0.01em]"
          />
          <span className="truncate text-[10.5px] font-semibold tracking-[0.14em] text-nav-muted uppercase">
            {portalLabel}
          </span>
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto overscroll-contain px-3 pt-4 pb-4 [scrollbar-color:var(--nav-active)_transparent]">
        <SidebarNav items={items} home={home} variant="rail" />
      </div>

      <div className="relative flex shrink-0 flex-col border-t border-nav-border p-3">
        <Tooltip open={collapsed ? undefined : false}>
          <TooltipTrigger asChild>
            <button
              type="button"
              data-nav-item=""
              onClick={() => setCollapsed(!collapsed)}
              aria-label={toggleLabel}
              aria-pressed={collapsed}
              className="flex h-9 items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-nav-muted transition-colors outline-none hover:bg-nav-hover hover:text-nav-foreground focus-visible:ring-2 focus-visible:ring-focus"
            >
              <ToggleIcon aria-hidden="true" className="size-[18px] shrink-0" />
              <span data-nav-label="">Collapse</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            {toggleLabel}
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
