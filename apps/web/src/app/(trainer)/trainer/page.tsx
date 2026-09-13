import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminDashboard } from '@/modules/dashboard/admin-dashboard';
import { getMe } from '@/lib/api/server';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Trainer dashboard' };

export default async function TrainerHomePage() {
  const me = await getMe();
  const hasBatches = (me?.person.batchIds.length ?? 0) > 0;
  return (
    <>
      <PageHeader
        title={`Hello, ${me?.user.name ?? 'Trainer'}`}
        description="Your batches and the students in them. Sessions, attendance and grading arrive with their modules."
        actions={
          hasBatches ? (
            <Button variant="outline" asChild>
              <Link href="/trainer/batches">My batches</Link>
            </Button>
          ) : null
        }
      />
      {hasBatches ? (
        <AdminDashboard batchesHref="/trainer/batches" />
      ) : (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">No batches yet</CardTitle>
            <CardDescription>
              An administrator assigns you to a batch; it then appears here with its roster.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Until then there is nothing for you to do in the portal.
          </CardContent>
        </Card>
      )}
    </>
  );
}
