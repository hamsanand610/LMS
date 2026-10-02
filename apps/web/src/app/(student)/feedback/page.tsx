import type { Metadata } from 'next';
import { LearnerFeedbackList } from '@/modules/feedback/learner-feedback';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Feedback' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Feedback"
        description="Short forms about your batch’s classes. Anonymous ones keep your name out of your answers."
      />
      <LearnerFeedbackList />
    </>
  );
}
