import type { Metadata } from 'next';
import { AssignmentWorkspace } from '@/modules/assignments/assignment-workspace';

export const metadata: Metadata = { title: 'Assignment' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssignmentWorkspace assignmentId={id} />;
}
