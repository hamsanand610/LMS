'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavigationItem } from '@lms/shared';
import { cn } from '@/lib/utils';
import { iconFor } from './icons';

const HomeIcon = iconFor('dashboard');

/** Groups items by their manifest group and highlights the active route. */
export function SidebarNav({
  items,
  home,
}: {
  items: NavigationItem[];
  home: { label: string; route: string };
}) {
  const pathname = usePathname();
  const groups = new Map<string, NavigationItem[]>();
  for (const item of items) {
    const key = item.group ?? '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  const isActive = (route: string) =>
    pathname === route || (route !== home.route && pathname.startsWith(`${route}/`));

  return (
    <nav aria-label="Main" className="flex flex-col gap-4 text-sm">
      <Link
        href={home.route}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 font-medium transition-colors',
          pathname === home.route
            ? 'bg-primary-soft text-primary'
            : 'text-foreground hover:bg-surface-2',
        )}
        aria-current={pathname === home.route ? 'page' : undefined}
      >
        <HomeIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {home.label}
      </Link>
      {[...groups.entries()].map(([group, groupItems]) => (
        <div key={group || 'ungrouped'}>
          {group ? (
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group}
            </p>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {groupItems.map((item) => {
              const Icon = iconFor(item.icon);
              const active = isActive(item.route);
              return (
                <li key={item.key}>
                  <Link
                    href={item.route}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 transition-colors',
                      active
                        ? 'bg-primary-soft font-medium text-primary'
                        : 'text-foreground hover:bg-surface-2',
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
