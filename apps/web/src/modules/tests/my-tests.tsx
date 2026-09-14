'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import type { TestCard } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api/http';

/** Upcoming, open now, and everything already sat. */
export function MyTests() {
  const [tab, setTab] = useState('live');
  const query = useQuery({
    queryKey: ['my-tests'],
    queryFn: () => api<TestCard[]>('/me/tests'),
  });

  if (query.isPending) return <LoadingRows rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const live = query.data.filter((t) => t.window === 'live' && t.attemptStatus !== 'submitted');
  const upcoming = query.data.filter((t) => t.window === 'upcoming');
  const history = query.data.filter(
    (t) => t.window === 'closed' || (t.attemptStatus && t.attemptStatus !== 'in_progress'),
  );

  const groups: Record<string, TestCard[]> = { live, upcoming, history };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="live">Open now ({live.length})</TabsTrigger>
        <TabsTrigger value="upcoming">Coming up ({upcoming.length})</TabsTrigger>
        <TabsTrigger value="history">Already sat ({history.length})</TabsTrigger>
      </TabsList>
      {Object.entries(groups).map(([key, cards]) => (
        <TabsContent key={key} value={key} className="pt-4">
          {cards.length === 0 ? (
            <EmptyState
              title={
                key === 'live'
                  ? 'Nothing open at the moment'
                  : key === 'upcoming'
                    ? 'Nothing scheduled yet'
                    : 'You have not sat a test yet'
              }
              description="Your trainer opens a test to your batch for a window of time."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((test) => (
                <TestCardView key={test.scheduleId} test={test} />
              ))}
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function TestCardView({ test }: { test: TestCard }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">{test.title}</CardTitle>
        <CardDescription className="capitalize">
          {test.kind} · {test.durationMinutes} minutes · {test.totalMarks} marks
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-auto space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          {test.window === 'upcoming'
            ? `Opens ${new Date(test.opensAt).toLocaleString()}`
            : test.window === 'live'
              ? `Closes ${new Date(test.closesAt).toLocaleString()}`
              : `Closed ${new Date(test.closesAt).toLocaleDateString()}`}
        </p>

        {test.resultAvailable ? (
          <p className="tabular-nums">
            You scored {test.score} of {test.totalMarks}
          </p>
        ) : test.attemptStatus === 'submitted' || test.attemptStatus === 'graded' ? (
          <Badge className="bg-info-soft text-info">Submitted; results not out yet</Badge>
        ) : null}

        {test.canStart ? (
          <Button asChild size="sm" className="w-full">
            <Link href={`/tests/${test.testId}`}>
              {test.attemptStatus === 'in_progress' ? 'Carry on' : 'Start'}
            </Link>
          </Button>
        ) : test.resultAvailable && test.attemptId ? (
          <Button asChild size="sm" variant="outline" className="w-full">
            <Link href={`/tests/${test.testId}/result`}>See the result</Link>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            {test.window === 'upcoming'
              ? 'You can start once it opens.'
              : test.attemptsUsed >= test.maxAttempts
                ? 'You have used your attempt.'
                : 'This window has closed.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
