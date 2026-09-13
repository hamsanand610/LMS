import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Colour families reused wherever a lifecycle status is shown. */
const TONES = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
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
  planned: 'info',
  running: 'success',
  archived: 'neutral',
  // documents and verification
  pending: 'warning',
  verified: 'success',
  rejected: 'danger',
  unverified: 'neutral',
  // announcements
  scheduled: 'info',
  expired: 'neutral',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = STATUS_TONES[status] ?? 'neutral';
  return (
    <Badge className={cn(TONES[tone], 'capitalize', className)}>{status.replace(/_/g, ' ')}</Badge>
  );
}
