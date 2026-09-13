import type { Metadata } from 'next';
import { TrainerDetail } from '@/modules/trainers/trainer-detail';

export const metadata: Metadata = { title: 'Trainer' };

export default async function TrainerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TrainerDetail trainerId={id} />;
}
