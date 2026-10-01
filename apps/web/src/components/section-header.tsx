import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/** A section's heading with an optional line of context and a "see all" link. */
export function SectionHeader({
  title,
  description,
  href,
  linkLabel,
  id,
  className,
}: {
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 id={id} className="font-display text-[1.25rem] leading-tight text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="group/see inline-flex shrink-0 items-center gap-1 rounded-md text-[13px] font-medium text-brand hover:underline"
        >
          {linkLabel ?? 'View all'}
          <ArrowRight
            className="size-3.5 transition-transform group-hover/see:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      ) : null}
    </div>
  );
}
