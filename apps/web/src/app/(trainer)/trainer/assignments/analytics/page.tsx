import type { Metadata } from 'next';
import { AssignmentAnalyticsView } from '@/modules/assignments/staff/analytics';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Assignment analytics' };

export default function Page() {
  return (
    <>
      <PageHeader
        back={{ href: '/trainer/assignments', label: 'All assignments' }}
        title="Assignment analytics"
        description="How your batches are doing: completion, scores, and the topics and questions they find hardest."
      />
      <AssignmentAnalyticsView showTrainers={false} />
    </>
  );
}
