import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Form control surface shared by inputs, textareas and select triggers. 16px on phones on
 * purpose: iOS zooms the page into any field smaller than that when it gains focus.
 */
export const controlClass =
  'w-full min-w-0 rounded-lg border border-input bg-surface text-base text-foreground md:text-sm shadow-xs transition-[color,border-color,box-shadow] duration-150 outline-none placeholder:text-muted-foreground/90 hover:border-border-strong focus-visible:border-focus focus-visible:ring-3 focus-visible:ring-focus/20 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-60 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/15 dark:bg-surface-2/40';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        controlClass,
        'h-9 px-3 py-1 file:mr-3 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
