import type { Metadata } from 'next';
import { DoubtThread } from '@/modules/doubts/doubt-thread';

export const metadata: Metadata = { title: 'Doubt' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DoubtThread id={id} role="staff" back={{ href: '/admin/doubts', label: 'Doubts' }} />;
}
