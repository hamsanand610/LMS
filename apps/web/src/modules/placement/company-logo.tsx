import { cn } from '@/lib/utils';
import { subjectTint } from '@/modules/courses/course-card';

/**
 * A company's logo when one was uploaded, otherwise its initial on a tint picked from its name, so
 * a board of companies without artwork still reads company by company. Never a borrowed logo.
 */
export function CompanyLogo({
  name,
  logoUrl,
  size = 'md',
  className,
}: {
  name: string;
  logoUrl: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const box =
    size === 'lg'
      ? 'size-14 rounded-xl text-xl'
      : size === 'sm'
        ? 'size-8 rounded-md text-xs'
        : 'size-11 rounded-lg text-base';
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- an uploaded logo of unknown size
      <img
        src={logoUrl}
        alt=""
        className={cn(box, 'shrink-0 border border-border bg-white object-contain p-1', className)}
      />
    );
  }
  const tint = subjectTint(name);
  return (
    <span
      aria-hidden="true"
      className={cn(box, 'flex shrink-0 items-center justify-center font-semibold', className)}
      style={{
        background: `color-mix(in oklab, ${tint} 16%, var(--surface))`,
        color: `color-mix(in oklab, ${tint} 70%, var(--foreground))`,
      }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
