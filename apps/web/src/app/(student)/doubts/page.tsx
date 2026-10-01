import type { Metadata } from 'next';
import { DoubtsList } from '@/modules/doubts/doubts-list';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Doubts' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Doubts"
        description="Questions you asked about your courses and lessons, and your trainers’ answers."
      />
      <DoubtsList role="learner" basePath="/doubts" />
    </>
  );
}
