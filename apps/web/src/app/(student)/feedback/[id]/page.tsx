import type { Metadata } from 'next';
import { LearnerFeedbackForm } from '@/modules/feedback/learner-feedback';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Feedback' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <PageHeader back={{ href: '/feedback', label: 'All feedback' }} title="Your feedback" />
      <LearnerFeedbackForm formId={id} />
    </>
  );
}
