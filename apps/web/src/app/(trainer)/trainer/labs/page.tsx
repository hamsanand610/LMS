import type { Metadata } from 'next';
import { StaffLabs } from '@/modules/labs/staff-labs';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Labs' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Labs"
        description="Coding, SQL, debugging and web labs: the ones you wrote, and the published ones your learners can do. Check a lab in the sandbox, publish it, then put it in the Labs."
      />
      <StaffLabs basePath="/trainer/labs" questionBase="/trainer/question-bank" />
    </>
  );
}
