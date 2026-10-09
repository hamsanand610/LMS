import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMe } from '@/lib/api/server';
import { KnowledgeSourceWorkspace } from '@/modules/ai/knowledge/knowledge-source';
import { canManageKnowledge } from '@/modules/ai/knowledge/knowledge-state';

export const metadata: Metadata = { title: 'Knowledge source' };

export default async function AdminKnowledgeSourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await getMe();
  if (!me || !canManageKnowledge(me)) notFound();
  const { id } = await params;
  return <KnowledgeSourceWorkspace sourceId={id} />;
}
