import type { Metadata } from 'next';
import { AssignmentsTable } from '@/modules/assignments/assignments-table';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Assignments' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Assignments"
        description="Practice sets built from the question bank and given to a batch, with a due date if you want one."
      />
      <AssignmentsTable />
    </>
  );
}
