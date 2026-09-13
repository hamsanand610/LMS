'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
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
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unread > 0 ? (
            <span className="text-xs font-normal text-muted-foreground">{unread} unread</span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {data && data.latest.length > 0 ? (
          data.latest.map((item) => (
            <DropdownMenuItem key={item.id} asChild onSelect={() => void open(item)}>
              <Link
                href={item.link ?? '/notifications'}
                className="flex flex-col items-start gap-0.5"
              >
                <span className={item.readAt ? 'text-sm' : 'text-sm font-semibold'}>
                  {item.title}
                </span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{item.body}</span>
              </Link>
            </DropdownMenuItem>
          ))
        ) : (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            Nothing new right now.
          </p>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/notifications">Open notifications</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
