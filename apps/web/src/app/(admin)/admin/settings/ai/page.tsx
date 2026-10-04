import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMe } from '@/lib/api/server';
import { canSeeAiPage } from '@/modules/ai/access';
import { AiSettingsForm } from '@/modules/ai/admin/ai-settings-form';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'AI settings' };

/** SI Academy AI's settings for the institute: the Super Admin's alone (`ai:manage`; Phase 7E). */
export default async function AiSettingsPage() {
  const me = await getMe();
  if (!me || !canSeeAiPage(me, 'ai:manage')) notFound();
  return (
    <>
      <PageHeader
        title="AI settings"
        description="Allowances, budget, what the provider may receive, models and the answer cache. Changes apply immediately and are audited."
      />
      <AiSettingsForm />
    </>
  );
}
