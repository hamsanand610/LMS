import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Colour families reused wherever a lifecycle status is shown. Each chip carries a marker and its
 * word, so the colour is never the only signal (plan §16.5).
 */
const TONES = {
  neutral: 'bg-surface-2 text-foreground-secondary',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  /** Something under way: the brand's burgundy. */
  brand: 'bg-primary-soft text-brand',
  /** Something still to come: muted champagne (Task 3 semantic palette). */
  upcoming: 'bg-achievement-soft text-achievement',
} as const;

export type StatusTone = keyof typeof TONES;

const STATUS_TONES: Record<string, StatusTone> = {
  // accounts
  invited: 'info',
  active: 'success',
  suspended: 'warning',
  deactivated: 'neutral',
  // students
  prospect: 'info',
  enrolled: 'info',
  completed: 'neutral',
  alumni: 'neutral',
  dropped: 'danger',
  // batches and programmes
  planned: 'upcoming',
  running: 'success',
  archived: 'neutral',
  // documents and verification
  pending: 'warning',
  verified: 'success',
  rejected: 'danger',
  unverified: 'neutral',
  // announcements and classes
  scheduled: 'upcoming',
  upcoming: 'upcoming',
  live: 'brand',
  in_progress: 'brand',
  expired: 'neutral',
  // placement drives and applications
  draft: 'neutral',
  open: 'success',
  closed: 'neutral',
  applied: 'info',
  shortlisted: 'info',
  selected: 'success',
  withdrawn: 'neutral',
  // doubts
  answered: 'info',
  resolved: 'success',
};

export function StatusBadge({
  status,
  label,
  tone,
  className,
}: {
  status: string;
  /** The word to show when the status key is not the word a person would use. */
  label?: string;
  /** Overrides the tone the status normally carries (the same word can mean different things). */
  tone?: StatusTone;
  className?: string;
}) {
  const resolved = tone ?? STATUS_TONES[status] ?? 'neutral';
  return (
    <Badge className={cn(TONES[resolved], !label && 'capitalize', className)}>
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current opacity-80" />
      {label ?? status.replace(/_/g, ' ')}
    </Badge>
  );
}
