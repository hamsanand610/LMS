import type { Metadata } from 'next';
import { InterviewPrep } from '@/modules/placement/interview-prep';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Interview prep' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Interview prep"
        description="Practice problems chosen company by company, grouped by topic. Solving one counts as coding practice."
      />
      <InterviewPrep />
    </>
  );
}
