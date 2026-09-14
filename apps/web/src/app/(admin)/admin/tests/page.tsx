import type { Metadata } from 'next';
import { TestsTable } from '@/modules/tests/tests-table';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Tests' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Tests"
        description="Timed papers. Build one, open it to a batch for a window, then release the results."
      />
      <TestsTable />
    </>
  );
}
