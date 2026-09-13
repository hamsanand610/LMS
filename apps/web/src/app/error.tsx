'use client';

import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Something went wrong
      </p>
      <h1 className="text-2xl font-semibold">We could not load this page</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Try again. If the problem continues, share this reference with support:{' '}
        <code className="rounded bg-surface-2 px-1">{error.digest ?? 'n/a'}</code>
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
