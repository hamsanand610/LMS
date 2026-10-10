'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/** Whether the box's content is larger than the box, kept current as either changes size. */
export function useScrolls(box: React.RefObject<HTMLDivElement | null>): boolean {
  const [scrolls, setScrolls] = React.useState(false);
  React.useEffect(() => {
    const element = box.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const measure = () =>
      setScrolls(
        element.scrollWidth > element.clientWidth + 1 ||
          element.scrollHeight > element.clientHeight + 1,
      );
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    measure();
    return () => observer.disconnect();
  }, [box]);
  return scrolls;
}

/*
 * Enterprise tables (plan §16.5): sticky header, readable density, quiet column headings, a hover
 * row and tabular figures. A header can only stick inside a box that scrolls vertically, so on
 * desktop a long table scrolls within a bounded area; a short one never reaches the bound and
 * behaves like a plain table. On a phone the box scrolls sideways only.
 */
function Table({ className, ...props }: React.ComponentProps<'table'>) {
  const box = React.useRef<HTMLDivElement>(null);
  const scrolls = useScrolls(box);
  return (
    <div
      ref={box}
      data-slot="table-container"
      // While the box scrolls it is a tab stop, so the rows and columns past its edge can be
      // reached from the keyboard even when they hold nothing focusable (WCAG 2.1.1).
      tabIndex={scrolls ? 0 : undefined}
      className="relative w-full overflow-x-auto overscroll-x-contain outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset lg:max-h-[calc(100dvh-13rem)] lg:overflow-y-auto"
    >
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm tabular-nums', className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        'sticky top-0 z-10 bg-surface-2 [&_tr]:border-b [&_tr]:border-border [&_tr]:hover:bg-transparent',
        className,
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('border-t bg-surface-2/60 font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b border-border/70 transition-colors duration-100 hover:bg-surface-2/55 has-aria-expanded:bg-surface-2/55 data-[state=selected]:bg-primary-soft/60',
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'h-10 px-3 text-left align-middle text-xs font-medium tracking-[0.01em] whitespace-nowrap text-muted-foreground first:pl-4 last:pr-4 [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'px-3 py-3 align-middle whitespace-nowrap first:pl-4 last:pr-4 [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-4 text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
