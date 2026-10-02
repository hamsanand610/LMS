import type { Metadata } from 'next';
import { FeedbackForms } from '@/modules/feedback/feedback-forms';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Feedback' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Feedback"
        description="Forms given to batches, once or every week, and what their learners said."
      />
      <FeedbackForms basePath="/admin/feedback" />
    </>
  );
}
