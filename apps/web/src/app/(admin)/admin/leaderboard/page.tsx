import type { Metadata } from 'next';
import { LeaderboardBoard } from '@/modules/leaderboard/leaderboard-board';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Leaderboard' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Leaderboard"
        description="Points per batch, counted from recorded work. Learners see their own batch’s board."
      />
      <LeaderboardBoard staff />
    </>
  );
}
