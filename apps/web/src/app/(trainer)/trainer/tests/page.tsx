import type { Metadata } from 'next';
import { TestsTable } from '@/modules/tests/tests-table';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Tests' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Tests"
        description="Your papers, their windows, and the results once you release them."
      />
      <TestsTable basePath="/trainer/tests" />
    </>
  );
}
