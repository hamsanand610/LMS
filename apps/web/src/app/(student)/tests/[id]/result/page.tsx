import type { Metadata } from 'next';
import { TestResult } from '@/modules/tests/test-result';

export const metadata: Metadata = { title: 'Result' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attempt?: string }>;
}) {
  const { id } = await params;
  const { attempt } = await searchParams;
  return <TestResult testId={id} attemptId={attempt} />;
}
