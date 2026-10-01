import type { Metadata } from 'next';
import { LeaderboardBoard } from '@/modules/leaderboard/leaderboard-board';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Leaderboard' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Leaderboard"
        description="Who is putting the work in, batch by batch. The same board your learners see."
      />
      <LeaderboardBoard staff />
    </>
  );
}
