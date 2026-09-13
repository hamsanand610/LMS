'use client';

import { LogOut, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api/http';
import { portalHome } from '@/lib/auth/portals';
import { useMe } from './me-context';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function UserMenu() {
  const me = useMe();
  const router = useRouter();
  const signOut = async () => {
    try {
      await api('/auth/logout', { method: 'POST', noRefresh: true });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Account menu"
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary">
            {initials(me.user.name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium">{me.user.name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{me.user.email}</p>
          <p className="mt-1 text-xs font-normal text-muted-foreground">
            {me.roles.map((r) => r.name).join(', ')}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {me.portals.length > 1
          ? me.portals.map((p) => (
              <DropdownMenuItem key={p} asChild>
                <Link href={portalHome(p)}>Switch to {p} portal</Link>
              </DropdownMenuItem>
            ))
          : null}
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserRound className="mr-2 h-4 w-4" aria-hidden="true" /> My account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
