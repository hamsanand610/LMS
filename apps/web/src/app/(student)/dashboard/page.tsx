import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getMe } from '@/lib/api/server';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function StudentDashboardPage() {
  const me = await getMe();
  const enrolled = (me?.person.batchIds.length ?? 0) > 0;
  return (
    <>
      <PageHeader
        title={`Hi, ${me?.user.name ?? 'there'}`}
        description={
          me?.branding.dashboard.welcomeText || 'Your courses, sessions and tasks will appear here.'
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your place here</CardTitle>
            <CardDescription>
              {me?.person.studentCode
                ? `Student number ${me.person.studentCode}`
                : 'Your student record is being set up.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {enrolled
              ? 'You are enrolled in a batch. Your trainers publish material to it, and anything new reaches you as a notification.'
              : 'You are not in a batch yet. Your institute adds you to one before classes begin.'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What to do now</CardTitle>
            <CardDescription>Keep your account and messages up to date.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/notifications">Notifications</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/account">My account</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="border-dashed sm:col-span-2">
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">Courses and schedule</CardTitle>
            <CardDescription>
              Lessons, the timetable, assignments and tests are built in the next phases. Nothing is
              hidden from you here: there is genuinely nothing published yet.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </>
  );
}
