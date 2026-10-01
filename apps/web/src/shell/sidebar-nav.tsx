'use client';

import { ChevronDown, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavigationItem } from '@lms/shared';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { iconFor } from './icons';
import { useCollapsedGroups, useNavCollapsed } from './nav-state';

const HomeIcon = iconFor('dashboard');

/** Pages that live outside the navigation but belong to one of its sections. */
const SECTION_ALIASES: Array<[prefix: string, route: string]> = [
  ['/trainer/sessions/', '/trainer/attendance'],
  ['/trainer/students/', '/trainer/batches'],
];

export function isActiveRoute(pathname: string, route: string, homeRoute: string): boolean {
  const alias = SECTION_ALIASES.find(([prefix]) => pathname.startsWith(prefix));
  const path = alias ? alias[1] : pathname;
  return path === route || (route !== homeRoute && path.startsWith(`${route}/`));
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  iconOnly,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  iconOnly: boolean;
  onNavigate?: () => void;
}) {
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      data-nav-item=""
      className={cn(
        'group/nav relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium',
        'transition-[background-color,color,box-shadow] duration-150 outline-none',
        'focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-nav',
        active
          ? // A burgundy tint with a soft light from its leading edge, not a red block.
            'bg-nav-active bg-[radial-gradient(9rem_4rem_at_0%_50%,color-mix(in_oklab,var(--nav-accent)_16%,transparent),transparent_70%)] text-nav-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.04),inset_0_0_0_1px_color-mix(in_oklab,var(--nav-accent)_10%,transparent)]'
          : 'text-nav-muted hover:bg-nav-hover hover:text-nav-foreground',
      )}
    >
      {/* The active item carries a rose rule as well as the fill: position, not colour alone. */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-nav-accent shadow-[0_0_10px_var(--nav-accent)] transition-opacity',
          active ? 'opacity-100' : 'opacity-0',
        )}
      />
      <Icon
        aria-hidden="true"
        className={cn(
          'size-[18px] shrink-0 transition-colors',
          active ? 'text-nav-accent' : 'text-nav-muted group-hover/nav:text-nav-foreground',
        )}
      />
      <span data-nav-label="" className="truncate">
        {label}
      </span>
    </Link>
  );
  // Tooltips only when the rail shows icons alone; the label stays in the accessibility tree.
  return (
    <Tooltip open={iconOnly ? undefined : false}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The navigation list, grouped by manifest group, for the desktop rail and the phone drawer alike.
 * Groups fold (remembered per browser); the group holding the current page is always open.
 */
export function SidebarNav({
  items,
  home,
  variant = 'rail',
  onNavigate,
}: {
  items: NavigationItem[];
  home: { label: string; route: string };
  variant?: 'rail' | 'drawer';
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [railCollapsed] = useNavCollapsed();
  const [folded, setFolded] = useCollapsedGroups();
  const iconOnly = variant === 'rail' && railCollapsed;

  const groups = new Map<string, NavigationItem[]>();
  for (const item of items) {
    const key = item.group ?? '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  const isActive = (route: string) => isActiveRoute(pathname, route, home.route);

  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      <ul className="flex flex-col gap-0.5">
        <li>
          <NavLink
            href={home.route}
            label={home.label}
            icon={HomeIcon}
            active={pathname === home.route}
            iconOnly={iconOnly}
            onNavigate={onNavigate}
          />
        </li>
      </ul>
      {[...groups.entries()].map(([group, groupItems]) => {
        const holdsCurrent = groupItems.some((item) => isActive(item.route));
        // Folding needs the group heading to undo it, and the icon rail has no headings: ignore it there.
        const isFolded = !iconOnly && Boolean(group) && folded.has(group) && !holdsCurrent;
        const listId = `nav-${variant}-${slug(group || 'more')}`;
        return (
          <div key={group || 'ungrouped'} className="flex flex-col gap-1">
            {group ? (
              <>
                <button
                  type="button"
                  data-nav-group-label=""
                  onClick={() => setFolded(group, !isFolded)}
                  aria-expanded={!isFolded}
                  aria-controls={listId}
                  className="group/label flex h-7 items-center justify-between rounded-md px-3 text-[10.5px] font-semibold tracking-[0.14em] text-nav-muted/85 uppercase transition-colors outline-none hover:text-nav-foreground focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <span>{group}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      'size-3.5 opacity-60 transition-transform duration-200 group-hover/label:opacity-100',
                      isFolded && '-rotate-90',
                    )}
                  />
                </button>
                <div
                  data-nav-divider=""
                  aria-hidden="true"
                  className="mx-3 hidden h-px bg-nav-border"
                />
              </>
            ) : null}
            <ul id={listId} hidden={isFolded || undefined} className="flex flex-col gap-0.5">
              {groupItems.map((item) => (
                <li key={item.key}>
                  <NavLink
                    href={item.route}
                    label={item.label}
                    icon={iconFor(item.icon)}
                    active={isActive(item.route)}
                    iconOnly={iconOnly}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
