import type { Metadata } from 'next';
import { ReportsIndex } from '@/modules/reports/reports-index';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Reports' };

export default function TrainerReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        description="The same reports an administrator sees, limited to the batches you teach."
      />
      <ReportsIndex basePath="/trainer/reports" />
    </>
  );
}
