import type { Metadata } from 'next';
import { MyAssignments } from '@/modules/assignments/my-assignments';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Assignments' };

export default function Page() {
  return (
    <>
      <PageHeader title="Assignments" description="Practice sets from your trainers." />
      <MyAssignments />
    </>
  );
}
