import type { Metadata } from 'next';
import { AssignmentBuilder } from '@/modules/assignments/staff/assignment-builder';

export const metadata: Metadata = { title: 'Assignment' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssignmentBuilder assignmentId={id} portal="trainer" />;
}
