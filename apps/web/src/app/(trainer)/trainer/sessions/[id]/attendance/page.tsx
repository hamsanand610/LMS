import type { Metadata } from 'next';
import { RollCall } from '@/modules/attendance/roll-call';

export const metadata: Metadata = { title: 'Mark attendance' };

export default async function TrainerRollCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RollCall sessionId={id} backHref="/trainer" />;
}
