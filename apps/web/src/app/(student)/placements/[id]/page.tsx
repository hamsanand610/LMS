import type { Metadata } from 'next';
import { DriveDetail } from '@/modules/placement/drive-detail';

export const metadata: Metadata = { title: 'Drive' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DriveDetail id={id} />;
}
