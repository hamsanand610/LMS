import type { Metadata } from 'next';
import { ExportsTable } from '@/modules/reports/exports-table';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Exports' };

export default function AdminExportsPage() {
  return (
    <>
      <PageHeader
        title="Exports"
        description="Files you have asked for. Each one is kept for seven days."
      />
      <ExportsTable />
    </>
  );
}
