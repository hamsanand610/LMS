'use client';

import { Menu } from 'lucide-react';
import { useState } from 'react';
import type { BrandingPublic, NavigationItem } from '@lms/shared';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { BrandLogo } from './brand-logo';
import { SidebarNav } from './sidebar-nav';

/** Drawer navigation below the desktop breakpoint. */
export function MobileNav({
  items,
  home,
  branding,
}: {
  items: NavigationItem[];
  home: { label: string; route: string };
  branding: BrandingPublic;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle>
            <BrandLogo branding={branding} size="sm" />
          </SheetTitle>
        </SheetHeader>
        <div className="px-3 py-4" onClick={() => setOpen(false)}>
          <SidebarNav items={items} home={home} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
