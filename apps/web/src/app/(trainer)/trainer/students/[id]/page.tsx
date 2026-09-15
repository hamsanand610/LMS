import type { Metadata } from 'next';
import { TrainerStudent } from '@/modules/students/trainer-student';

export const metadata: Metadata = { title: 'Student' };

export default async function TrainerStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TrainerStudent studentId={id} />;
}
