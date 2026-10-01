import type { Metadata } from 'next';
import { AssignmentAnalyticsView } from '@/modules/assignments/staff/analytics';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Assignment analytics' };

export default function Page() {
  return (
    <>
      <PageHeader
        back={{ href: '/admin/assignments', label: 'All assignments' }}
        title="Assignment analytics"
        description="Completion, scores and submissions across every batch, with the topics and questions learners find hardest."
      />
      <AssignmentAnalyticsView showTrainers />
    </>
  );
}
