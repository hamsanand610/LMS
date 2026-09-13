import type { Metadata } from 'next';
import { ProgressOverview } from '@/modules/progress/progress-overview';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Progress' };

export default function StudentProgressPage() {
  return (
    <>
      <PageHeader title="Progress" description="How far you have got, course by course." />
      <ProgressOverview />
    </>
  );
}
