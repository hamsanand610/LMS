import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoadingRows } from '@/components/page-states';
import { MyAssignments } from '@/modules/assignments/my-assignments';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Assignments' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Assignments"
        description="Coding, SQL, quizzes and projects from your trainers: what is due, what is done and what comes next."
      />
      {/* The filters live in the address, which is only known in the browser. */}
      <Suspense fallback={<LoadingRows rows={6} />}>
        <MyAssignments />
      </Suspense>
    </>
  );
}
