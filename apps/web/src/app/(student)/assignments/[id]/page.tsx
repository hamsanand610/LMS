import type { Metadata } from 'next';
import { AssignmentOutline } from '@/modules/assignments/assignment-outline';

export const metadata: Metadata = { title: 'Assignment' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssignmentOutline assignmentId={id} />;
}
