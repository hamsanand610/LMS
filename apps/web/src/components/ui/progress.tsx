'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Progress as ProgressPrimitive } from 'radix-ui';

/** The indicator's colour follows the measure's meaning (Task 3): red is for learning progress. */
const TONE = {
  default: 'bg-primary',
  success: 'bg-success',
  achievement: 'bg-achievement',
  warning: 'bg-warning',
  neutral: 'bg-foreground-secondary/70',
} as const;

function Progress({
  className,
  value,
  tone = 'default',
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { tone?: keyof typeof TONE }) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        'relative flex h-1.5 w-full items-center overflow-x-hidden rounded-full bg-surface-3',
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          'size-full flex-1 rounded-full transition-transform duration-500 ease-out',
          TONE[tone],
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
