import type { Metadata } from 'next';
import { FeedbackResultsView } from '@/modules/feedback/feedback-results';

export const metadata: Metadata = { title: 'Feedback' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FeedbackResultsView formId={id} />;
}
