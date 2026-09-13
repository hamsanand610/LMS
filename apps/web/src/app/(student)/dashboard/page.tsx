import type { Metadata } from 'next';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getMe } from '@/lib/api/server';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function StudentDashboardPage() {
  const me = await getMe();
  return (
    <>
      <PageHeader
        title={`Hi, ${me?.user.name ?? 'there'}`}
        description={
          me?.branding.dashboard.welcomeText || 'Your courses, sessions and tasks will appear here.'
        }
      />
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base text-muted-foreground">No courses yet</CardTitle>
          <CardDescription>
            Once your institute publishes a course to your batch it appears here (Phase 3).
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  );
}
