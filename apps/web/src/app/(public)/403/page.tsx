import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Access denied' };

export default function AccessDeniedPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">403</p>
      <h1 className="text-2xl font-semibold">You do not have access to this page</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Your account does not include this area. Ask an administrator if you think that is a
        mistake.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Back to home</Link>
      </Button>
    </main>
  );
}
