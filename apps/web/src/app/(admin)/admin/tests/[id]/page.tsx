import type { Metadata } from 'next';
import { TestWorkspace } from '@/modules/tests/test-workspace';

export const metadata: Metadata = { title: 'Test' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TestWorkspace testId={id} />;
}
