import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page may have moved, or the link is wrong.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Go to the home page</Link>
      </Button>
    </main>
  );
}
