'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, FolderKanban } from 'lucide-react';
import Link from 'next/link';
import type { LearnerAssignmentList } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/http';
import { formatDateTime } from '@/lib/format';
import { AssignmentStatusBadge } from './status';

/**
 * The learner's projects (Phase 2, D6): the assignments that hold a project question. A project is
 * opened, handed in, reviewed and resubmitted exactly as any assignment is, so this view lists
 * them and leads into the assignment pages rather than repeating them.
 */
export function ProjectsList() {
  const query = useQuery({
    queryKey: ['my-assignments', 'projects'],
    queryFn: () =>
      api<LearnerAssignmentList>('/me/assignments?questionType=project&pageSize=100&sort=due'),
  });

  if (query.isPending) return <LoadingRows rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const projects = query.data.data;
  if (projects.length === 0) {
    return (
      <EmptyState
        title="No projects yet"
        description="When your trainers set a project, it appears here with its brief, its resources and what to hand in."
        action={
          <Button asChild variant="outline">
            <Link href="/assignments">See your assignments</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {projects.map((project) => (
        <li key={project.id} className="flex flex-col rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-brand">
              <FolderKanban className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] leading-snug font-semibold text-foreground">
                {project.title}
              </h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {[
                  project.courseTitle,
                  project.dueAt ? `Due ${formatDateTime(project.dueAt)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'No due date'}
              </p>
            </div>
            <AssignmentStatusBadge status={project.status} className="shrink-0" />
          </div>
          {project.description ? (
            <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-foreground-secondary">
              {project.description}
            </p>
          ) : null}
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 text-[13px]">
            <span className="text-muted-foreground tabular-nums">
              {project.answered} of {project.questionCount} handed in
            </span>
            <Button asChild size="sm" variant="outline">
              <Link href={`/assignments/${project.id}`}>
                Open
                {/* Every card has an "Open"; the title says which one to a screen reader. */}
                <span className="sr-only"> {project.title}</span>
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
