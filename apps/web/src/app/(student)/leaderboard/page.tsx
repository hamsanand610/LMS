import type { Metadata } from 'next';
import { LeaderboardBoard } from '@/modules/leaderboard/leaderboard-board';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Leaderboard' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Leaderboard"
        description="Points for lessons, practice, assignments and tests, counted from the work you have done. Your batch only."
      />
      <LeaderboardBoard />
    </>
  );
}
