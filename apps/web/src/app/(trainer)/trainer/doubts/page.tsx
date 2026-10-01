import type { Metadata } from 'next';
import { DoubtsList } from '@/modules/doubts/doubts-list';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Doubts' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Doubts"
        description="Questions from the learners of your batches. The longest waiting are first."
      />
      <DoubtsList role="staff" basePath="/trainer/doubts" />
    </>
  );
}
