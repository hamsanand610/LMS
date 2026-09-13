import type { Metadata } from 'next';
import { StudentsTable } from '@/modules/students/students-table';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Students' };

export default function StudentsPage() {
  return (
    <>
      <PageHeader
        title="Students"
        description="Everyone learning at this institute. Add them one at a time or import an intake."
      />
      <StudentsTable />
    </>
  );
}
