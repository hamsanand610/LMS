import * as React from 'react';
import { cn } from '@/lib/utils';
import { controlClass } from './input';

/**
 * A native <select> on the shared control surface. Native on purpose: phones open the operating
 * system's picker, which beats any custom list there, and it needs no extra JavaScript. The
 * chevron is a themed background image (globals.css), so it follows light and dark.
 */
function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        controlClass,
        'h-9 cursor-pointer appearance-none bg-(image:--select-chevron) bg-size-[16px] bg-position-[right_0.625rem_center] bg-no-repeat py-1 pr-9 pl-3',
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
