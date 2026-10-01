'use client';

import { ArrowLeftRight, BellRing, LogOut, Moon, Settings, Sun, SunMoon } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { portalHome } from '@/lib/auth/portals';
import { useMe } from './me-context';
import { type ThemeMode, useThemeMode } from './theme/theme-store';
import { useSignOut } from './use-sign-out';

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

const PORTAL_NAME: Record<string, string> = {
  admin: 'Admin',
  trainer: 'Trainer',
  student: 'Student',
};

export function UserMenu() {
  const me = useMe();
  const signOut = useSignOut();
  const [mode, setMode] = useThemeMode();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="Account menu"
      >
        <Avatar className="size-8 ring-1 ring-border transition-shadow hover:ring-border-strong">
          {me.user.avatarUrl ? <AvatarImage src={me.user.avatarUrl} alt="" /> : null}
          <AvatarFallback className="bg-primary-soft text-[11px] font-semibold text-brand">
            {initials(me.user.name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2 font-normal">
          <Avatar className="size-9">
            {me.user.avatarUrl ? <AvatarImage src={me.user.avatarUrl} alt="" /> : null}
            <AvatarFallback className="bg-primary-soft text-xs font-semibold text-brand">
              {initials(me.user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{me.user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{me.user.email}</p>
          </div>
        </DropdownMenuLabel>
        {me.roles.length > 0 ? (
          <p className="px-2 pb-2 text-xs text-muted-foreground">
            {me.roles.map((r) => r.name).join(' · ')}
          </p>
        ) : null}
        <DropdownMenuSeparator />
        {me.portals.length > 1 ? (
          <>
            <DropdownMenuGroup>
              {me.portals.map((p) => (
                <DropdownMenuItem key={p} asChild>
                  <Link href={portalHome(p)}>
                    <ArrowLeftRight aria-hidden="true" /> Switch to {PORTAL_NAME[p] ?? p} portal
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings aria-hidden="true" /> Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings/notifications">
              <BellRing aria-hidden="true" /> Notification preferences
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="eyebrow px-2 pt-1.5 pb-1">Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mode} onValueChange={(v) => setMode(v as ThemeMode)}>
          <DropdownMenuRadioItem value="system">
            <SunMoon aria-hidden="true" /> System
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <Sun aria-hidden="true" /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon aria-hidden="true" /> Dark
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut aria-hidden="true" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
