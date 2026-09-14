import type { Metadata } from 'next';
import { TestAttempt } from '@/modules/tests/test-attempt';

export const metadata: Metadata = { title: 'Test' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ attempt?: string }>;
}) {
  const { attempt } = await searchParams;
  if (!attempt) {
    return <p className="text-sm text-muted-foreground">No attempt was named in the address.</p>;
  }
  return <TestAttempt attemptId={attempt} />;
}
