import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Slot } from 'radix-ui';

/*
 * Badges are soft tints, never solid brand fills: a page with a dozen status chips must not turn
 * red. Status colour comes from StatusBadge, which adds a marker so colour is never the only signal.
 */
const badgeVariants = cva(
  'group/badge inline-flex h-[22px] w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border border-transparent px-2 text-[11.5px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-focus has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        default: 'bg-primary-soft text-brand [a]:hover:bg-primary-muted/60',
        secondary: 'bg-surface-2 text-foreground-secondary [a]:hover:bg-surface-3',
        destructive: 'bg-danger-soft text-danger [a]:hover:bg-danger/15',
        outline: 'border-border text-foreground-secondary [a]:hover:bg-surface-2',
        ghost: 'text-foreground-secondary hover:bg-surface-2',
        link: 'text-brand underline-offset-4 hover:underline',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
