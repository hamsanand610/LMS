import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMe } from '@/lib/api/server';
import { canSeeAiPage } from '@/modules/ai/access';
import { AiUsageReport } from '@/modules/ai/admin/ai-usage-report';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'AI usage' };

/**
 * SI Academy AI's usage by the learners of the trainer's batches (Phase 7E): the API decides the
 * scope; the page shows what it returns, and never a question or an answer.
 */
export default async function TrainerAiUsagePage() {
  const me = await getMe();
  if (!me || !canSeeAiPage(me, 'ai:usage_read')) notFound();
  return (
    <>
      <PageHeader
        title="AI usage"
        description="How the learners of your batches use SI Academy AI: questions, tokens and estimated cost. Figures only."
      />
      <AiUsageReport />
    </>
  );
}
