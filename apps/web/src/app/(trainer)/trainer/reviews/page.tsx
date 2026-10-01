import type { Metadata } from 'next';
import { ReviewQueue } from '@/modules/assignments/staff/review-queue';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Reviews' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Reviews"
        description="Answers from your batches waiting for you, oldest first, and the decisions already made."
      />
      <ReviewQueue portal="trainer" />
    </>
  );
}
