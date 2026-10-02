import type { Metadata } from 'next';
import { PageHeader } from '@/shell/page-header';
import { FailedJobs } from '@/modules/health/failed-jobs';
import { SystemHealthCards } from '@/modules/health/system-health-cards';

export const metadata: Metadata = { title: 'System health' };

export default function SystemHealthPage() {
  return (
    <>
      <PageHeader
        title="System health"
        description="Live status of the database, storage, email and background jobs for this deployment."
      />
      <SystemHealthCards />
      <FailedJobs />
    </>
  );
}
