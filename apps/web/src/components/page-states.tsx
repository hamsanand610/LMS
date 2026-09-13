import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { isApiError } from '@/lib/api/errors';

/** Layout-matching placeholder for lists and forms. */
export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

/** Explains what will appear and offers the primary action when the caller may create items. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <p className="font-medium">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Recoverable error with retry; shows the request id so support can find the log line. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const problem = isApiError(error) ? error.problem : null;
  const message = isApiError(error)
    ? error.message
    : error instanceof Error
      ? error.message
      : 'Something went wrong';
  return (
    <div className="rounded-lg border border-danger/40 bg-danger-soft p-4 text-sm" role="alert">
      <p className="font-medium text-danger">{message}</p>
      {problem?.requestId ? (
        <p className="mt-1 text-xs text-muted-foreground">Reference: {problem.requestId}</p>
      ) : null}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
