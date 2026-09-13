import type { Metadata } from 'next';
import { BatchesTable } from '@/modules/batches/batches-table';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'My batches' };

export default function TrainerBatchesPage() {
  return (
    <>
      <PageHeader title="My batches" description="The cohorts you are assigned to teach." />
      <BatchesTable basePath="/trainer/batches" />
    </>
  );
}
