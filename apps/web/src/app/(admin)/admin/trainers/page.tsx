import type { Metadata } from 'next';
import { TrainersTable } from '@/modules/trainers/trainers-table';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Trainers' };

export default function TrainersPage() {
  return (
    <>
      <PageHeader
        title="Trainers"
        description="Teaching staff and the batches they are assigned to."
      />
      <TrainersTable />
    </>
  );
}
