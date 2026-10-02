import type { Metadata } from 'next';
import { LabPreview } from '@/modules/labs/lab-pages';

export const metadata: Metadata = { title: 'Lab preview' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LabPreview key={id} questionId={id} basePath="/trainer/labs" />;
}
