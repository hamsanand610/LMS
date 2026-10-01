'use client';

import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { StatusPage } from '@/components/status-page';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <StatusPage
      code="500"
      label="Something went wrong"
      icon={TriangleAlert}
      title="We could not load this page"
      actions={
        <>
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/">Go to the home page</Link>
          </Button>
        </>
      }
    >
      Try again. If the problem continues, share this reference with support:{' '}
      <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[13px] text-foreground">
        {error.digest ?? 'n/a'}
      </code>
    </StatusPage>
  );
}
