import type { Metadata } from 'next';
import { BatchesTable } from '@/modules/batches/batches-table';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Batches' };

export default function BatchesPage() {
  return (
    <>
      <PageHeader
        title="Batches"
        description="Cohorts running a programme. Open one to manage its roster and trainers."
      />
      <BatchesTable />
    </>
  );
}
