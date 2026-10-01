import { ArrowRight, CircleCheck, Clock, Layers, UserRound } from 'lucide-react';
import Link from 'next/link';
import type { CourseProgress } from '@lms/shared';
import { ProgressRing } from '@/components/progress-ring';
import { cn } from '@/lib/utils';
import { formatMinutes, humanise, plural } from '@/lib/format';

/** Validated categorical tints (--chart-2…6); a subject always gets the same one. */
const COVER_TINTS = ['--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6'];

export function subjectTint(subject: string): string {
  let hash = 0;
  for (const char of subject.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `var(${COVER_TINTS[hash % COVER_TINTS.length]})`;
}

function hashOf(value: string): number {
  let hash = 0;
  for (const char of value.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

/** Where a plate's light comes from, and its lit arc: rose (the brand) or champagne. */
const PLATES = [
  { corner: '100% 0%', centre: [100, 0], glow: 'var(--brand-primary)', arc: '#f0a3a8' },
  { corner: '0% 0%', centre: [0, 0], glow: '#b8924f', arc: '#e3c893' },
  { corner: '100% 100%', centre: [100, 100], glow: 'var(--brand-primary)', arc: '#f0a3a8' },
  { corner: '0% 100%', centre: [0, 100], glow: '#b8924f', arc: '#e3c893' },
] as const;

/**
 * The course's cover: its thumbnail when there is one, otherwise an ink plate in the product's own
 * language — the Burgundy Glow from one corner and the Progress Arc's concentric lines, lit rose or
 * champagne — with the subject set small. The corner and the light follow the subject, so a
 * catalogue without artwork still reads course by course without turning into a rainbow.
 */
export function CourseCover({
  title,
  subject,
  thumbnailUrl,
  compact = false,
  className,
}: {
  title: string;
  subject: string;
  thumbnailUrl: string | null;
  /** A thumbnail beside a row rather than a card's header: no caption. */
  compact?: boolean;
  className?: string;
}) {
  if (thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- uploaded course artwork of unknown size
      <img src={thumbnailUrl} alt="" className={cn('h-28 w-full object-cover', className)} />
    );
  }
  const plate = PLATES[hashOf(subject || title) % PLATES.length]!;
  const [cx, cy] = plate.centre;
  return (
    <div
      aria-hidden="true"
      className={cn('relative isolate h-28 w-full overflow-hidden bg-[#140d0c]', className)}
    >
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(22rem 12rem at ${plate.corner}, color-mix(in oklab, ${plate.glow} 42%, transparent), transparent 70%)`,
        }}
      />
      <svg
        viewBox="0 0 100 100"
        className={cn(
          'absolute size-[22rem] overflow-visible',
          cx === 100 ? 'right-0' : 'left-0',
          cy === 0 ? 'top-0' : 'bottom-0',
        )}
      >
        {[28, 46, 64, 82].map((r) => (
          <circle
            key={r}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="rgb(255 240 235 / 0.09)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <circle
          cx={cx}
          cy={cy}
          r={46}
          fill="none"
          stroke={plate.arc}
          strokeOpacity="0.75"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 46 * 0.16} ${2 * Math.PI * 46}`}
          transform={`rotate(${(hashOf(title) % 5) * 18 + 20} ${cx} ${cy})`}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="grain absolute inset-0 opacity-[0.07] mix-blend-overlay" />
      {compact ? null : (
        <span className="absolute bottom-3 left-4 max-w-[80%] truncate text-[10.5px] font-semibold tracking-[0.16em] text-[#efe7df]/75 uppercase">
          {subject ? subject.replace(/[-_]+/g, ' ') : 'Course'}
        </span>
      )}
    </div>
  );
}

/** One of the learner's courses: cover, subject and level, the arc, and where to pick it up. */
export function CourseCard({ course }: { course: CourseProgress }) {
  const done = course.status === 'completed' || course.progressPct >= 100;
  const meta = [course.subject, course.level].filter(Boolean).map(humanise).join(' · ') || 'Course';
  return (
    <article className="group/card relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md">
      <CourseCover
        title={course.title}
        subject={course.subject}
        thumbnailUrl={course.thumbnailUrl}
      />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="eyebrow truncate">{meta}</p>
            <h3 className="mt-1.5 text-[17px] leading-snug font-semibold tracking-[-0.01em] text-foreground">
              {/* The title is the card's link; the stretched hit area makes the whole card clickable. */}
              <Link
                href={`/courses/${course.courseId}`}
                className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-focus"
              >
                {course.title}
              </Link>
            </h3>
          </div>
          <ProgressRing
            value={course.progressPct}
            size={52}
            stroke={4.5}
            tone={done ? 'success' : 'default'}
            label={`${course.title}: ${course.progressPct}% complete`}
          />
        </div>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <li className="inline-flex items-center gap-1">
            <Layers className="size-3.5" aria-hidden="true" />
            {plural(course.moduleCount, 'module')}
          </li>
          {course.durationMinutes > 0 ? (
            <li className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden="true" />
              {formatMinutes(course.durationMinutes)}
            </li>
          ) : null}
          {course.instructors.length > 0 ? (
            <li className="inline-flex min-w-0 items-center gap-1">
              <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{course.instructors.join(', ')}</span>
            </li>
          ) : null}
        </ul>
        <div className="mt-auto border-t border-border pt-3.5">
          <p className="text-xs text-muted-foreground tabular-nums">
            {course.completedLessons} of {course.lessonCount}{' '}
            {course.optionalLessons > 0 ? 'required lessons' : 'lessons'} done
          </p>
          {done ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-success">
              <CircleCheck className="size-4" aria-hidden="true" /> Course complete
            </p>
          ) : course.nextLessonId ? (
            <Link
              href={`/courses/${course.courseId}/lessons/${course.nextLessonId}`}
              className="relative z-10 mt-1.5 flex min-w-0 items-center gap-2 rounded-md text-[13px] text-foreground-secondary transition-colors hover:text-foreground"
            >
              <span className="shrink-0 text-muted-foreground">
                {course.progressPct === 0 ? 'Start with' : 'Up next'}
              </span>
              <span className="min-w-0 truncate font-medium">{course.nextLessonTitle}</span>
              <ArrowRight
                className="ml-auto size-4 shrink-0 text-brand transition-transform group-hover/card:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
