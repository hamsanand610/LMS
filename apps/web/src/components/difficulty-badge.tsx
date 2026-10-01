import { DIFFICULTY_LABELS, type QuestionDifficulty } from '@lms/shared';
import { cn } from '@/lib/utils';

/** From first steps (calm) to company rounds (the brand's strongest tone). */
const TONES: Record<string, string> = {
  beginner: 'bg-success-soft text-success',
  foundation: 'bg-success-soft text-success',
  easy: 'bg-success-soft text-success',
  medium: 'bg-warning-soft text-warning',
  intermediate: 'bg-warning-soft text-warning',
  hard: 'bg-primary-soft text-brand',
  advanced: 'bg-primary-soft text-brand',
  interview: 'bg-info-soft text-info',
  company: 'bg-achievement-soft text-achievement',
};

/** A difficulty or level as a chip: a tone and the word, so the colour is never the only signal. */
export function DifficultyBadge({ value, className }: { value: string; className?: string }) {
  if (!value) return null;
  const key = value.toLowerCase();
  const label =
    DIFFICULTY_LABELS[key as QuestionDifficulty] ??
    value.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center rounded-full px-2 text-[11.5px] font-medium whitespace-nowrap',
        TONES[key] ?? 'bg-surface-2 text-foreground-secondary',
        className,
      )}
    >
      {label}
    </span>
  );
}
