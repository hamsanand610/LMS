import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMe } from '@/lib/api/server';
import { KnowledgeSources } from '@/modules/ai/knowledge/knowledge-sources';
import { canManageKnowledge } from '@/modules/ai/knowledge/knowledge-state';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Knowledge base' };

/** SI Academy AI's knowledge base, for the people who manage it (Roadmap Phase 10). */
export default async function AdminKnowledgePage() {
  const me = await getMe();
  if (!me || !canManageKnowledge(me)) notFound();
  return (
    <>
      <PageHeader
        title="Knowledge base"
        description="The documents SI Academy AI answers from: uploaded, read into passages, indexed once published, and cited in every answer."
      />
      <KnowledgeSources />
    </>
  );
}
