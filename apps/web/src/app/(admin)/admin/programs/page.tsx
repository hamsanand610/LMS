import type { Metadata } from 'next';
import { ProgramsTable } from '@/modules/batches/programs-table';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Programmes' };

export default function ProgramsPage() {
  return (
    <>
      <PageHeader
        title="Programmes"
        description="Curriculum templates. Every batch runs one programme and inherits its length."
      />
      <ProgramsTable />
    </>
  );
}
