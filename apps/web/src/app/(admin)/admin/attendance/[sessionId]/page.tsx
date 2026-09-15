import type { Metadata } from 'next';
import { RollCall } from '@/modules/attendance/roll-call';

export const metadata: Metadata = { title: 'Roll call' };

export default async function AdminRollCallPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <RollCall sessionId={sessionId} backHref="/admin/attendance" />;
}
