import type { Metadata } from 'next';
import { AssignmentsTable } from '@/modules/assignments/assignments-table';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Assignments' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Assignments"
        description="What you have given your batches, and the answers waiting for you to mark."
      />
      <AssignmentsTable basePath="/trainer/assignments" />
    </>
  );
}
