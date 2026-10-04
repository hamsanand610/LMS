import { OctagonAlert, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { isApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils';

/** Layout-matching placeholder for lists and forms; announced to screen readers as loading. */
export function LoadingRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2.5', className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-11 w-full rounded-lg"
          // A slight stagger so a list reads as rows arriving, not one block blinking.
          style={{ animationDelay: `${i * 90}ms` }}
        />
      ))}
    </div>
  );
}

/** The Progress Arc waiting to begin: a dashed ring with the first stretch drawn. Decorative. */
function EmptyMark() {
  return (
    <svg viewBox="0 0 40 40" className="mx-auto mb-4 size-10" aria-hidden="true">
      <circle
        cx="20"
        cy="20"
        r="15"
        fill="none"
        strokeWidth="1.5"
        strokeDasharray="2.5 4"
        className="stroke-border-strong"
      />
      <path
        d="M20 5 A15 15 0 0 1 35 20"
        fill="none"
        strokeWidth="2.25"
        strokeLinecap="round"
        className="stroke-primary/70"
      />
      <circle cx="35" cy="20" r="2.4" className="fill-primary" />
    </svg>
  );
}

/**
 * Explains what will appear here and, when the person can create it, offers the action
 * (plan §16.5: "icon-free text + action"). Never leaves a page looking broken because it is empty.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed border-border-strong/80 bg-surface/60 px-6 py-12 text-center',
        className,
      )}
    >
      <EmptyMark />
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-pretty text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/**
 * Recoverable error with retry; shows the request id so support can find the log line. A page may
 * word the error itself (`message`), as SI Academy AI's pages do from the error's code.
 */
export function ErrorState({
  error,
  onRetry,
  message: worded,
}: {
  error: unknown;
  onRetry?: () => void;
  message?: string;
}) {
  const problem = isApiError(error) ? error.problem : null;
  const message =
    worded ??
    (isApiError(error)
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Something went wrong');
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3.5 text-sm"
      role="alert"
    >
      <OctagonAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-danger">{message}</p>
        {problem?.requestId ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Reference{' '}
            <code className="rounded bg-surface px-1 py-px font-mono text-[11px] text-foreground-secondary">
              {problem.requestId}
            </code>
          </p>
        ) : null}
        {onRetry ? (
          <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            <RotateCw aria-hidden="true" />
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}
