import type { Metadata } from 'next';
import { PageHeader } from '@/shell/page-header';
import { AuditLogTable } from '@/modules/audit/audit-log-table';

export const metadata: Metadata = { title: 'Audit log' };

export default function AuditLogPage() {
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Who changed what, and when. Entries are append-only."
      />
      <AuditLogTable />
    </>
  );
}
