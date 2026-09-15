import type { Metadata } from 'next';
import { ReportsIndex } from '@/modules/reports/reports-index';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Reports' };

export default function AdminReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        description="Filter, sort and export what the platform has measured."
      />
      <ReportsIndex basePath="/admin/reports" />
    </>
  );
}
