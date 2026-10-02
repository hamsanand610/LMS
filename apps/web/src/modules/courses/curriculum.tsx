'use client';

import {
  Circle,
  CircleCheck,
  CirclePlay,
  Code2,
  FileText,
  FlaskConical,
  Lock,
  Paperclip,
  Video,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { CourseDetail, LessonSummary, LessonType } from '@lms/shared';
import { ProgressRing } from '@/components/progress-ring';
import { cn } from '@/lib/utils';

export const LESSON_TYPE: Record<LessonType, { label: string; icon: LucideIcon }> = {
  video: { label: 'Video', icon: Video },
  article: { label: 'Reading', icon: FileText },
  resources: { label: 'Resources', icon: Paperclip },
  practice: { label: 'Practice', icon: Code2 },
  lab: { label: 'Lab', icon: FlaskConical },
};

export function minutesOf(lesson: { durationSeconds: number }): number {
  return Math.round(lesson.durationSeconds / 60);
}

/**
 * A lesson's state as an icon with a spoken label. Never the word "Completed" — that word belongs
 * to the lesson page's own status, and saying it twice would make it ambiguous.
 */
export function LessonStatusIcon({
  status,
  locked,
  current,
  className,
}: {
  status: LessonSummary['status'];
  locked?: boolean;
  current?: boolean;
  className?: string;
}) {
  if (locked) {
    return (
      <span className={cn('inline-flex text-muted-foreground', className)}>
        <Lock className="size-4" aria-hidden="true" />
        <span className="sr-only">locked</span>
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className={cn('inline-flex text-success', className)}>
        <CircleCheck className="size-[18px]" aria-hidden="true" />
        <span className="sr-only">done</span>
      </span>
    );
  }
  if (status === 'in_progress' || current) {
    return (
      <span className={cn('inline-flex text-brand', className)}>
        <CirclePlay className="size-[18px]" aria-hidden="true" />
        <span className="sr-only">{status === 'in_progress' ? 'in progress' : 'up next'}</span>
      </span>
    );
  }
  return (
    <span className={cn('inline-flex text-border-strong', className)}>
      <Circle className="size-[18px]" aria-hidden="true" />
      <span className="sr-only">not started</span>
    </span>
  );
}

/** Done and total lessons for one module. */
export function moduleCounts(lessons: LessonSummary[]): { done: number; total: number } {
  return { done: lessons.filter((l) => l.status === 'completed').length, total: lessons.length };
}

/**
 * The course's contents beside a lesson: where you are, what is done, what is locked. Used in the
 * desktop rail and, on a phone, inside the contents sheet.
 */
export function CurriculumRail({
  course,
  courseId,
  currentLessonId,
  onNavigate,
}: {
  course: CourseDetail;
  courseId: string;
  currentLessonId: string;
  onNavigate?: () => void;
}) {
  const pct = course.progressPct ?? 0;
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3.5 border-b border-border px-4 py-4">
        <ProgressRing
          value={pct}
          size={48}
          stroke={4.5}
          tone={pct >= 100 ? 'success' : 'default'}
          label={`${course.title}: ${pct}% through`}
        />
        <div className="min-w-0">
          <p className="eyebrow">Course contents</p>
          <Link
            href={`/courses/${courseId}`}
            onClick={onNavigate}
            className="mt-0.5 block text-sm leading-snug font-semibold text-foreground hover:underline"
          >
            {course.title}
          </Link>
        </div>
      </div>
      <ol className="flex flex-col py-2">
        {course.modules.map((module, index) => {
          const locked = module.unlocked === false;
          const { done, total } = moduleCounts(module.lessons);
          return (
            <li key={module.id} className="px-2 py-1.5">
              <div className="flex items-baseline justify-between gap-2 px-2 py-1.5">
                <p className="text-[12px] leading-snug font-semibold text-foreground-secondary">
                  <span className="text-muted-foreground tabular-nums">{index + 1}.</span>{' '}
                  {module.title}
                </p>
                <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                  {locked ? (
                    <Lock className="inline size-3" aria-label="Locked" />
                  ) : (
                    `${done}/${total}`
                  )}
                </span>
              </div>
              <ul className="flex flex-col gap-px">
                {module.lessons.map((lesson) => {
                  const current = lesson.id === currentLessonId;
                  const minutes = minutesOf(lesson);
                  const row = (
                    <>
                      <LessonStatusIcon
                        status={lesson.status}
                        locked={locked}
                        className="mt-px shrink-0"
                      />
                      <span className="min-w-0 flex-1 leading-snug">{lesson.title}</span>
                      {minutes > 0 ? (
                        <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                          {minutes}m
                        </span>
                      ) : null}
                    </>
                  );
                  return (
                    <li key={lesson.id}>
                      {locked ? (
                        <div className="flex items-start gap-2.5 rounded-lg px-2 py-2 text-[13px] text-muted-foreground">
                          {row}
                        </div>
                      ) : (
                        <Link
                          href={`/courses/${courseId}/lessons/${lesson.id}`}
                          onClick={onNavigate}
                          aria-current={current ? 'page' : undefined}
                          className={cn(
                            'relative flex items-start gap-2.5 rounded-lg px-2 py-2 text-[13px] transition-colors',
                            current
                              ? 'bg-primary-soft font-medium text-foreground before:absolute before:top-2 before:bottom-2 before:-left-1 before:w-[3px] before:rounded-full before:bg-primary'
                              : 'text-foreground-secondary hover:bg-surface-2 hover:text-foreground',
                          )}
                        >
                          {row}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
              {locked && module.lockReason ? (
                <p className="px-2 pt-1 text-[11px] text-muted-foreground">{module.lockReason}</p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
