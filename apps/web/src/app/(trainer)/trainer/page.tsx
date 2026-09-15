import type { Metadata } from 'next';
import { TrainerDashboard } from '@/modules/dashboard/trainer-dashboard';
import { getMe } from '@/lib/api/server';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Trainer dashboard' };

export default async function TrainerHomePage() {
  const me = await getMe();
  return (
    <>
      <PageHeader
        title={`Hello, ${me?.user.name ?? 'Trainer'}`}
        description="Today's classes, what is waiting to be marked, and how your batches are doing."
      />
      <TrainerDashboard />
    </>
  );
}
