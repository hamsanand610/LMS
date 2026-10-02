import type { Metadata } from 'next';
import { StaffLabAttempts } from '@/modules/labs/staff-attempts';

export const metadata: Metadata = { title: 'Lab attempts' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StaffLabAttempts key={id} questionId={id} basePath="/admin/labs" />;
}
