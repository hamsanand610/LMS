import type { Metadata } from 'next';
import { TestResult } from '@/modules/tests/test-result';

export const metadata: Metadata = { title: 'Result' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TestResult testId={id} />;
}
