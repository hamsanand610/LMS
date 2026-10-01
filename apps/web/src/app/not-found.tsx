import { Compass } from 'lucide-react';
import Link from 'next/link';
import { StatusPage } from '@/components/status-page';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      label="Nothing here"
      icon={Compass}
      title="Page not found"
      actions={
        <Button asChild>
          <Link href="/">Go to the home page</Link>
        </Button>
      }
    >
      The page may have moved, or the link is wrong.
    </StatusPage>
  );
}
