import type { Metadata } from 'next';
import { AdminDashboard } from '@/modules/dashboard/admin-dashboard';
import { getMe } from '@/lib/api/server';
import { longDate } from '@/lib/greeting';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Admin dashboard' };

export default async function AdminHomePage() {
  const me = await getMe();
  return (
    <>
      <PageHeader
        eyebrow={longDate(new Date())}
        title={`Welcome, ${me?.user.name ?? 'Admin'}`}
        description="What needs attention first, then who is here, what is being taught and how it is going."
      />
      <AdminDashboard />
    </>
  );
}
