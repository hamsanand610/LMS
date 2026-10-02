import type { Metadata } from 'next';
import { FeedbackForms } from '@/modules/feedback/feedback-forms';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Feedback' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Feedback"
        description="Feedback forms about you. Figures appear once five learners have answered a round."
      />
      <FeedbackForms basePath="/trainer/feedback" />
    </>
  );
}
