'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Tabs as TabsPrimitive } from 'radix-ui';

/*
 * Filter tabs (`<Tabs filter>`) narrow the list below them instead of switching between panels, so
 * they have no `TabsContent`. Their tabs then point at no panel: Radix's `aria-controls` would name
 * an element that does not exist, which screen readers and axe report as an invalid reference.
 */
const TabsPanelsContext = React.createContext(true);

function Tabs({
  className,
  orientation = 'horizontal',
  filter = false,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root> & { filter?: boolean }) {
  return (
    <TabsPanelsContext.Provider value={!filter}>
      <TabsPrimitive.Root
        data-slot="tabs"
        data-orientation={orientation}
        // `min-w-0 max-w-full`: in a row of controls, the tabs never push the page wider than the
        // screen; their list scrolls instead.
        className={cn(
          'group/tabs flex min-w-0 max-w-full gap-5 data-horizontal:flex-col',
          className,
        )}
        {...props}
      />
    </TabsPanelsContext.Provider>
  );
}

/*
 * Underline tabs by default (plan §16.5: "underline tabs with counts; scrollable on mobile"): the
 * list runs the full width on a hairline and scrolls sideways when it does not fit. `segmented` is
 * kept for small inline switches; on a phone, a switch wider than the screen scrolls sideways too
 * (four options on Interview prep made the whole page 418 px wide on a 390 px phone).
 */
const tabsListVariants = cva(
  'group/tabs-list inline-flex items-center text-muted-foreground group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col',
  {
    variants: {
      variant: {
        line: 'w-full justify-start gap-6 overflow-x-auto overflow-y-hidden border-b border-border [scrollbar-width:none] group-data-horizontal/tabs:h-11',
        segmented:
          'w-fit max-w-full justify-center-safe gap-1 overflow-x-auto overflow-y-hidden rounded-lg bg-surface-2 p-1 [scrollbar-width:none] group-data-horizontal/tabs:h-10',
      },
    },
    defaultVariants: {
      variant: 'line',
    },
  },
);

function TabsList({
  className,
  variant = 'line',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const panels = React.useContext(TabsPanelsContext);
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      {...(panels ? {} : { 'aria-controls': undefined })}
      className={cn(
        "group/tab relative inline-flex shrink-0 items-center justify-center gap-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // Underline: the active tab is darker and carries the brand rule on the hairline.
        'group-data-[variant=line]/tabs-list:h-full group-data-[variant=line]/tabs-list:px-0.5 group-data-[variant=line]/tabs-list:text-foreground-secondary group-data-[variant=line]/tabs-list:hover:text-foreground group-data-[variant=line]/tabs-list:data-active:text-foreground',
        'after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 after:transition-opacity group-data-[variant=line]/tabs-list:data-active:after:opacity-100 group-data-[variant=segmented]/tabs-list:after:hidden',
        // Segmented: a raised chip on a stone track.
        'group-data-[variant=segmented]/tabs-list:h-full group-data-[variant=segmented]/tabs-list:rounded-md group-data-[variant=segmented]/tabs-list:px-3 group-data-[variant=segmented]/tabs-list:hover:text-foreground group-data-[variant=segmented]/tabs-list:data-active:bg-surface group-data-[variant=segmented]/tabs-list:data-active:text-foreground group-data-[variant=segmented]/tabs-list:data-active:shadow-sm',
        'group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start',
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 text-sm outline-none', className)}
      {...props}
    />
  );
}

/**
 * A count beside a tab label, shown as a quiet pill. The parentheses are there but visually hidden,
 * so the tab's text reads "Open now (2)" to a screen reader and to anything reading its text.
 */
function TabsCount({ className, children, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'rounded-full bg-surface-2 px-1.5 py-px text-[11px] font-semibold text-muted-foreground tabular-nums group-data-[state=active]/tab:bg-primary-soft group-data-[state=active]/tab:text-brand',
        className,
      )}
      {...props}
    >
      <span className="sr-only"> (</span>
      {children}
      <span className="sr-only">)</span>
    </span>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, TabsCount, tabsListVariants };
