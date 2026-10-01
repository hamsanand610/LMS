import { cn } from '@/lib/utils';

/** The bar's colour follows the measure's meaning (Task 3): red is for learning progress only. */
const BAR = {
  default: 'bg-primary',
  warning: 'bg-warning',
  success: 'bg-success',
  achievement: 'bg-achievement',
  neutral: 'bg-foreground-secondary/70',
} as const;

/**
 * A labelled measure: name, figure, bar and one line of context. The optional threshold draws a
 * tick where the institute's expectation sits, so "below" is visible without a colour key.
 */
export function Meter({
  label,
  value,
  detail,
  threshold,
  tone = 'default',
  className,
}: {
  label: string;
  /** 0–100, or null when there is nothing to measure yet. */
  value: number | null;
  detail?: React.ReactNode;
  threshold?: number;
  tone?: 'default' | 'warning' | 'success' | 'achievement' | 'neutral';
  className?: string;
}) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-foreground-secondary">{label}</span>
        <span
          className={cn(
            'stat-figure text-xl',
            tone === 'warning' ? 'text-warning' : 'text-foreground',
          )}
        >
          {value === null ? '—' : `${pct}%`}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value === null ? undefined : pct}
        className="relative h-1.5 rounded-full bg-surface-3"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-700 ease-out', BAR[tone])}
          style={{ width: `${pct}%` }}
        />
        {threshold !== undefined ? (
          <span
            aria-hidden="true"
            className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground/60"
            style={{ left: `${threshold}%` }}
          />
        ) : null}
      </div>
      {detail ? <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
