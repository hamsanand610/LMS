'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff } from 'lucide-react';
import Link from 'next/link';
import type { NotificationItem } from '@lms/shared';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api/http';
import { cn } from '@/lib/utils';

interface Summary {
  unread: number;
  latest: NotificationItem[];
}

/** Unread badge plus the newest few messages. Polls quietly; the centre has the full list. */
export function NotificationBell() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['notification-summary'],
    queryFn: () => api<Summary>('/me/notifications/summary'),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const unread = data?.unread ?? 0;

  const open = async (item: NotificationItem) => {
    if (item.readAt) return;
    await api(`/me/notifications/${item.id}/read`, { method: 'PATCH' });
    void queryClient.invalidateQueries({ queryKey: ['notification-summary'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative inline-flex size-9 items-center justify-center rounded-lg text-foreground-secondary transition-colors outline-none hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus aria-expanded:bg-surface-2 aria-expanded:text-foreground"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        <Bell className="size-[18px]" aria-hidden="true" />
        {unread > 0 ? (
          <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground tabular-nums ring-2 ring-background">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-1.5rem))] p-0"
      >
        <DropdownMenuLabel className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-foreground">Notifications</span>
          {unread > 0 ? (
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-brand tabular-nums">
              {unread} unread
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-[22rem] overflow-y-auto p-1.5">
          {data && data.latest.length > 0 ? (
            data.latest.map((item) => (
              <DropdownMenuItem
                key={item.id}
                asChild
                onSelect={() => void open(item)}
                className="items-start gap-3 rounded-lg px-2.5 py-2.5"
              >
                <Link href={item.link ?? '/notifications'}>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      item.readAt ? 'bg-transparent' : 'bg-primary',
                    )}
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span
                      className={cn(
                        'text-sm leading-snug',
                        item.readAt ? 'text-foreground-secondary' : 'font-semibold text-foreground',
                      )}
                    >
                      {item.readAt ? null : <span className="sr-only">Unread: </span>}
                      {item.title}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{item.body}</span>
                  </span>
                </Link>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <BellOff className="size-5 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Nothing new right now.</p>
            </div>
          )}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="p-1.5">
          <DropdownMenuItem
            asChild
            className="justify-center rounded-lg py-2 font-medium text-brand"
          >
            <Link href="/notifications">Open notifications</Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
