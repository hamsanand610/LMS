import type { Metadata } from 'next';
import { AdminDashboard } from '@/modules/dashboard/admin-dashboard';
import { getMe } from '@/lib/api/server';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Admin dashboard' };

export default async function AdminHomePage() {
  const me = await getMe();
  return (
    <>
      <PageHeader
        title={`Welcome, ${me?.user.name ?? 'Admin'}`}
        description={
          me?.branding.dashboard.welcomeText ||
          'People and cohorts at a glance. Learning and assessment figures join these tiles as those modules arrive.'
        }
      />
      <AdminDashboard />
    </>
  );
}
