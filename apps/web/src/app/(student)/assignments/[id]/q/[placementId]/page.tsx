import type { Metadata } from 'next';
import { QuestionWorkspace } from '@/modules/assignments/question-workspace';

export const metadata: Metadata = { title: 'Question' };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; placementId: string }>;
}) {
  const { id, placementId } = await params;
  // Keyed, so moving to the next question starts its drafts and console afresh.
  return <QuestionWorkspace key={placementId} assignmentId={id} placementId={placementId} />;
}
