import { ProgressRing } from '@/components/progress-ring';
import { cn } from '@/lib/utils';

export interface OverviewFigure {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'danger' | 'warning' | 'success';
  /** A short line under the figure saying what it is worked out from. */
  hint?: string;
}

const TONE = {
  default: '',
  danger: 'text-danger',
  warning: 'text-warning',
  success: 'text-success',
} as const;

/**
 * One dominant measure as a Progress Arc with its context, then the supporting figures beside it —
 * the hierarchy a list page's summary needs, instead of a row of equal tiles.
 */
export function OverviewBand({
  label,
  pct,
  detail,
  figures,
  className,
}: {
  label: string;
  /** 0–100. */
  pct: number;
  detail: React.ReactNode;
  /** Three supporting figures. */
  figures: [OverviewFigure, OverviewFigure, OverviewFigure];
  className?: string;
}) {
  const value = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div
      className={cn(
        'grid gap-px overflow-hidden rounded-xl border border-border bg-border shadow-xs lg:grid-cols-[1.4fr_1fr_1fr_1fr]',
        className,
      )}
    >
      <div className="flex items-center gap-5 bg-card px-6 py-5">
        <ProgressRing
          value={value}
          size={64}
          stroke={6}
          tone={value >= 100 ? 'success' : 'default'}
          label={`${label}: ${value}%`}
        >
          {/* The figure beside the arc carries the number; the arc carries the shape. */}
          <span />
        </ProgressRing>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground-secondary">{label}</p>
          <p className="stat-figure mt-1.5 text-[2rem]">
            {value}
            <span className="ml-0.5 text-[0.5em] font-medium text-muted-foreground">%</span>
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">{detail}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px bg-border lg:contents">
        {figures.map((figure) => (
          <div key={figure.label} className="bg-card px-5 py-4 lg:px-6 lg:py-5">
            <p className="text-xs text-muted-foreground">{figure.label}</p>
            <p className={cn('stat-figure mt-2 text-[1.75rem]', TONE[figure.tone ?? 'default'])}>
              {figure.value}
            </p>
            {figure.hint ? (
              <p className="mt-1 text-xs text-muted-foreground">{figure.hint}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
