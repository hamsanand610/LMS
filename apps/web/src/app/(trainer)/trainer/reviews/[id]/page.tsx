import type { Metadata } from 'next';
import { ReviewDetail } from '@/modules/assignments/staff/review-detail';

export const metadata: Metadata = { title: 'Review' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReviewDetail submissionId={id} portal="trainer" />;
}
