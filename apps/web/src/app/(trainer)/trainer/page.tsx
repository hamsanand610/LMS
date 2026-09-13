import type { Metadata } from 'next';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getMe } from '@/lib/api/server';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Trainer dashboard' };

export default async function TrainerHomePage() {
  const me = await getMe();
  return (
    <>
      <PageHeader
        title={`Hello, ${me?.user.name ?? 'Trainer'}`}
        description="Your batches, sessions and grading queue appear here as those modules are delivered (Phases 2–5)."
      />
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base text-muted-foreground">Nothing to show yet</CardTitle>
          <CardDescription>
            You are signed in to the trainer portal. Batches and schedules arrive in Phase 2 and 3.
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  );
}
