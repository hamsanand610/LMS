'use client';

import { useQuery } from '@tanstack/react-query';
import { FileCheck } from 'lucide-react';
import Link from 'next/link';
import type { TrainerDashboard } from '@lms/shared';
import { api } from '@/lib/api/http';

/**
 * Written test answers are marked from each test's grading queue; this says how many are waiting
 * and leads there, so a reviewer working from the review queue does not miss them (TRN-06).
 */
export function TestAnswersWaiting() {
  const query = useQuery({
    queryKey: ['trainer', 'dashboard'],
    queryFn: () => api<TrainerDashboard>('/trainer/dashboard'),
  });
  const waiting = query.data?.grading.tests ?? 0;
  if (waiting === 0) return null;
  return (
    <Link
      href="/trainer/tests"
      className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm transition-colors hover:bg-surface-2"
    >
      <FileCheck className="size-5 text-brand" aria-hidden />
      <span className="flex-1">
        {waiting} written test {waiting === 1 ? 'answer is' : 'answers are'} waiting for a mark.
        Open a test and its Grading tab to mark them.
      </span>
    </Link>
  );
}
