import { Search } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from './input';

/**
 * An ordinary text input with the search glass inside it, for the filter above a list. The width
 * belongs to the wrapper (`wrapperClassName`), so the icon stays pinned to the field.
 */
function SearchInput({
  className,
  wrapperClassName,
  ...props
}: React.ComponentProps<typeof Input> & { wrapperClassName?: string }) {
  return (
    <div className={cn('relative', wrapperClassName)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input className={cn('pl-9', className)} {...props} />
    </div>
  );
}

export { SearchInput };
