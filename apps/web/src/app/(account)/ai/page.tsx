import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMe } from '@/lib/api/server';
import { canUseAi } from '@/modules/ai/access';
import { AiWorkspacePending } from '@/modules/ai/ai-workspace-pending';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'SI Academy AI' };

/**
 * SI Academy AI's workspace, in each person's own portal shell (Roadmap Phase 7). While the workspace
 * is not on for the person — `module.ai`, `ai.workspace` and `ai:chat`, all three — the page does not
 * exist for them. Phase 7A: the boundary only; the workspace arrives in Phase 7E.
 */
export default async function AiPage() {
  const me = await getMe();
  if (!me || !canUseAi(me, 'workspace')) notFound();
  return (
    <>
      <PageHeader
        title="SI Academy AI"
        description="Ask about what you are learning, within what you can already see."
      />
      <AiWorkspacePending />
    </>
  );
}
