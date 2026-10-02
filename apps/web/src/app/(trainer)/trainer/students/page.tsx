import type { Metadata } from 'next';
import { StudentsTable } from '@/modules/students/students-table';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Students' };

export default function TrainerStudentsPage() {
  return (
    <>
      <PageHeader
        title="Students"
        description="The learners of the batches you teach. Open one to see their progress, attendance and results."
      />
      <StudentsTable basePath="/trainer/students" />
    </>
  );
}
