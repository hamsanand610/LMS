import type { Metadata } from 'next';
import { getMe } from '@/lib/api/server';
import { StudentDashboard } from '@/modules/dashboard/student-dashboard';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function StudentDashboardPage() {
  const me = await getMe();
  return (
    <>
      <PageHeader
        title={`Hi, ${me?.user.name ?? 'there'}`}
        description={
          me?.branding.dashboard.welcomeText ||
          'Your classes today, where you left off, and what has been announced.'
        }
      />
      <StudentDashboard />
    </>
  );
}
