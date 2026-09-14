import type { Metadata } from 'next';
import { PracticeWorkspace } from '@/modules/practice/practice-workspace';

export const metadata: Metadata = { title: 'Problem' };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PracticeWorkspace slug={slug} />;
}
