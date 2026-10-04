import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { LoadingRows } from '@/components/page-states';
import { getMe } from '@/lib/api/server';
import { canUseAi } from '@/modules/ai/access';
import { AiWorkspace } from '@/modules/ai/ai-workspace';

export const metadata: Metadata = { title: 'SI Academy AI' };

/**
 * SI Academy AI's workspace, in each person's own portal shell (Roadmap Phase 7E): their
 * conversations and the open one. While the workspace is not on for the person — `module.ai`,
 * `ai.workspace` and `ai:chat`, all three — the page does not exist for them; the API checks every
 * request again whatever the page shows.
 */
export default async function AiPage() {
  const me = await getMe();
  if (!me || !canUseAi(me, 'workspace')) notFound();
  return (
    <Suspense fallback={<LoadingRows rows={6} />}>
      <AiWorkspace />
    </Suspense>
  );
}
