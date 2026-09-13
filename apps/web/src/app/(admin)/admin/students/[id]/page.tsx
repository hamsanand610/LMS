import type { Metadata } from 'next';
import { StudentDetail } from '@/modules/students/student-detail';

export const metadata: Metadata = { title: 'Student' };

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudentDetail studentId={id} />;
}
