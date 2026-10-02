'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CircleCheck, Eye, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import type {
  LessonLabView,
  PracticeProblemDetail,
  PracticeSubmissionDetail,
  PracticeSubmissionRecord,
  RunOutcome,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/http';
import { humanise } from '@/lib/format';
import { refreshLearnerState } from '@/lib/learner-state';
import { LabWorkspace, type LabSubmitOutcome } from './lab-workspace';

/** A lab from the catalogue: `/labs/[slug]`. */
export function CatalogueLab({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const base = `/practice/problems/${slug}`;
  const query = useQuery({
    queryKey: ['practice', slug],
    queryFn: () => api<PracticeProblemDetail>(base),
  });
  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const detail = query.data;
  return (
    <LabWorkspace
      key={detail.questionId}
      source={{
        detail,
        eyebrow: detail.topic ? humanise(detail.topic) : 'Labs',
        back: { href: '/labs', label: 'Labs' },
        run: (input) => api<RunOutcome>(`${base}/run`, { body: input }),
        submit: (input) => api<LabSubmitOutcome>(`${base}/submissions`, { body: input }),
        history: {
          key: ['practice', slug, 'submissions'],
          list: () => api<PracticeSubmissionRecord[]>(`${base}/submissions`),
          detail: (id) => api<PracticeSubmissionDetail>(`${base}/submissions/${id}`),
        },
        drafts: true,
        onSubmitted: async () => {
          // A pass here can complete a lab lesson in any course, so every course and lesson the
          // browser holds is refreshed with the dashboard, the progress page and the streak.
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['practice', slug] }),
            queryClient.invalidateQueries({ queryKey: ['practice', 'summary'] }),
            queryClient.invalidateQueries({ queryKey: ['course'] }),
            queryClient.invalidateQueries({ queryKey: ['lesson'] }),
            refreshLearnerState(queryClient),
          ]);
        },
      }}
    />
  );
}

/** A lab opened from a course lesson: `/courses/[id]/lessons/[lessonId]/lab`. */
export function LessonLab({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const queryClient = useQueryClient();
  const base = `/lessons/${lessonId}/lab`;
  const query = useQuery({
    queryKey: ['lesson', lessonId, 'lab'],
    queryFn: () => api<LessonLabView>(base),
  });
  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const view = query.data;
  const lessonHref = `/courses/${courseId}/lessons/${lessonId}`;
  if (!view.available || !view.problem) {
    return (
      <EmptyState
        title="This lab is not available"
        description={view.reason ?? 'Try again later.'}
        action={
          <Button asChild variant="outline">
            <Link href={lessonHref}>Back to the lesson</Link>
          </Button>
        }
      />
    );
  }
  return (
    <LabWorkspace
      key={view.problem.questionId}
      source={{
        detail: view.problem,
        eyebrow: `${view.courseTitle} · ${view.lessonTitle}`,
        back: { href: lessonHref, label: 'Back to the lesson' },
        run: (input) => api<RunOutcome>(`${base}/run`, { body: input }),
        submit: (input) => api<LabSubmitOutcome>(`${base}/submissions`, { body: input }),
        history: {
          key: ['lesson', lessonId, 'lab', 'submissions'],
          list: () => api<PracticeSubmissionRecord[]>(`${base}/submissions`),
          detail: (id) => api<PracticeSubmissionDetail>(`${base}/submissions/${id}`),
        },
        drafts: true,
        banner: (
          <div className="flex flex-col gap-3 rounded-xl border border-primary-muted bg-primary-soft/40 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-foreground-secondary">
              <GraduationCap className="size-4 shrink-0 text-brand" aria-hidden="true" />
              {view.completed
                ? 'This lesson is complete.'
                : 'Passing this lab completes the lesson.'}
            </p>
            {view.completed && view.nextLessonId ? (
              <Button asChild size="sm">
                <Link href={`/courses/${courseId}/lessons/${view.nextLessonId}`}>
                  Next lesson
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            ) : view.completed ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-success">
                <CircleCheck className="size-4" aria-hidden="true" />
                Done
              </span>
            ) : null}
          </div>
        ),
        onSubmitted: async (outcome) => {
          if (outcome.lessonCompleted && !view.completed) toast.success('Lesson complete.');
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['practice', 'summary'] }),
            refreshLearnerState(queryClient, { courseId, lessonId }),
          ]);
        },
      }}
    />
  );
}

/** A lab as learners will see it, for its author or a manager: `…/labs/[id]/preview`. */
export function LabPreview({ questionId, basePath }: { questionId: string; basePath: string }) {
  const base = `/practice/labs/${questionId}/preview`;
  const query = useQuery({
    queryKey: ['labs', 'preview', questionId],
    queryFn: () => api<PracticeProblemDetail>(base),
  });
  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const detail = query.data;
  const state = detail.preview;
  return (
    <LabWorkspace
      key={questionId}
      source={{
        detail,
        eyebrow: 'Preview',
        back: { href: basePath, label: 'Labs' },
        run: (input) => api<RunOutcome>(`${base}/run`, { body: input }),
        drafts: false,
        banner: (
          <p className="flex items-start gap-2 rounded-xl border border-info/30 bg-info-soft/40 px-4 py-3 text-sm text-foreground-secondary">
            <Eye className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
            <span>
              This is the lab as learners see it. Runs go to the sandbox and are not recorded;
              hidden cases stay hidden here too.
              {state
                ? ` It is ${state.status}${state.inCatalogue ? ' and in the Labs catalogue' : ''}.`
                : ''}
            </span>
          </p>
        ),
      }}
    />
  );
}
