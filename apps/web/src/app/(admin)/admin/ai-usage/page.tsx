import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMe } from '@/lib/api/server';
import { canSeeAiPage } from '@/modules/ai/access';
import { AiUsageReport } from '@/modules/ai/admin/ai-usage-report';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'AI usage' };

/** SI Academy AI's usage, as far as the person's `ai:usage_read` scope reaches (Phase 7E). */
export default async function AdminAiUsagePage() {
  const me = await getMe();
  if (!me || !canSeeAiPage(me, 'ai:usage_read')) notFound();
  return (
    <>
      <PageHeader
        title="AI usage"
        description="Questions, tokens and estimated cost per day and per person. Figures only: never a question or an answer."
      />
      <AiUsageReport />
    </>
  );
}
