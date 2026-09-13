import type { Metadata } from 'next';
import { BatchDetail } from '@/modules/batches/batch-detail';

export const metadata: Metadata = { title: 'Batch' };

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BatchDetail batchId={id} />;
}
