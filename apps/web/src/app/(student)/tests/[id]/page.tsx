import type { Metadata } from 'next';
import { TestInstructions } from '@/modules/tests/test-attempt';

export const metadata: Metadata = { title: 'Before you start' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TestInstructions testId={id} />;
}
