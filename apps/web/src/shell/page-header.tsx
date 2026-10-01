import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * The page title row: an optional way back and eyebrow, the title, what the page is for, and its
 * actions. One primary action at most (plan §16.5); the rest belong in outline or ghost buttons.
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  meta,
  back,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** A short label above the title: the section, a record's type, a status. */
  eyebrow?: React.ReactNode;
  /** Chips and facts under the title: a difficulty, a status, the marks. */
  meta?: React.ReactNode;
  /** Where "back" goes, for pages below a list (plan §15.2: back links, not breadcrumbs, for learners). */
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {back ? (
          <Link
            href={back.href}
            className="group/back mb-3 inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft
              className="size-3.5 transition-transform group-hover/back:-translate-x-0.5"
              aria-hidden="true"
            />
            {back.label}
          </Link>
        ) : null}
        {eyebrow ? <div className="eyebrow mb-2">{eyebrow}</div> : null}
        <h1 className="font-display text-[2rem] leading-[1.04] text-balance text-foreground sm:text-[2.375rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
        {meta ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-muted-foreground">
            {meta}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
