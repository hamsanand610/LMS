import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getMe } from '@/lib/api/server';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Admin dashboard' };

/**
 * Phase 1 admin home: orientation and quick links. The metric tiles from the customer's list
 * arrive with the reporting module in Phase 5; this page states that plainly instead of faking numbers.
 */
export default async function AdminHomePage() {
  const me = await getMe();
  const items = me?.navigation.admin ?? [];
  return (
    <>
      <PageHeader
        title={`Welcome, ${me?.user.name ?? 'Admin'}`}
        description={
          me?.branding.dashboard.welcomeText ||
          'Manage people, content and settings from the navigation.'
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Card key={item.key} className="transition-colors hover:border-primary/40">
            <Link href={item.route} className="block h-full">
              <CardHeader>
                <CardTitle className="text-base">{item.label}</CardTitle>
                <CardDescription>
                  {item.group ? `${item.group} · ` : ''}
                  {item.route}
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>
        ))}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">Metrics dashboard</CardTitle>
            <CardDescription>
              Student, attendance, completion and score tiles are delivered with the reporting
              module (Phase 5).
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Nothing is shown here until the numbers are real.
          </CardContent>
        </Card>
      </div>
    </>
  );
}
