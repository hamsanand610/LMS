import { cn } from '@/lib/utils';

/*
 * The Progress Arc — the product's signature motif (Task 3, ADR-0015). A thin track, the arc with a
 * round cap and a small bright head where the learner is now, drawn in SVG from one scale so the arc,
 * the figure and the label always agree. Colour follows meaning, not decoration: the brand for
 * learning progress, emerald for the streak and for what is done, champagne for achievement.
 */
const TONES = {
  default: { track: 'stroke-surface-3', arc: 'stroke-primary', head: 'fill-primary' },
  /** Ink: a measure that is neither progress nor a verdict. */
  neutral: {
    track: 'stroke-surface-3',
    arc: 'stroke-foreground-secondary',
    head: 'fill-foreground-secondary',
  },
  success: { track: 'stroke-success-soft', arc: 'stroke-success', head: 'fill-success' },
  streak: { track: 'stroke-streak-soft', arc: 'stroke-streak', head: 'fill-streak' },
  achievement: {
    track: 'stroke-achievement-soft',
    arc: 'stroke-achievement',
    head: 'fill-achievement',
  },
  warning: { track: 'stroke-warning-soft', arc: 'stroke-warning', head: 'fill-warning' },
  onDark: { track: 'stroke-white/[0.09]', arc: 'stroke-nav-accent', head: 'fill-[#ffe4e4]' },
} as const;

export type ProgressTone = keyof typeof TONES;

export function ProgressRing({
  value,
  size = 96,
  stroke = 8,
  label,
  tone = 'default',
  threshold,
  className,
  children,
}: {
  /** 0–100. */
  value: number;
  size?: number;
  stroke?: number;
  /** What the ring measures, for screen readers ("Core Java, 60% complete"). */
  label: string;
  tone?: ProgressTone;
  /** A tick where an expectation sits (e.g. the institute's attendance threshold), 0–100. */
  threshold?: number;
  className?: string;
  /** Replaces the centred percentage (for a custom centre). */
  children?: React.ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - stroke) / 2;
  const centre = size / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const colours = TONES[tone];
  const dark = tone === 'onDark';
  // The head: where the arc ends. Hidden at 0 (nothing yet) and 100 (the ring closes).
  const angle = (clamped / 100) * 2 * Math.PI;
  const head = clamped > 0 && clamped < 100;
  const tick =
    threshold === undefined ? null : (Math.max(0, Math.min(100, threshold)) / 100) * 2 * Math.PI;
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 overflow-visible"
        aria-hidden="true"
      >
        <circle
          cx={centre}
          cy={centre}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={colours.track}
        />
        {clamped > 0 ? (
          <circle
            cx={centre}
            cy={centre}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn(
              'arc-draw transition-[stroke-dashoffset] duration-700 ease-out',
              colours.arc,
            )}
            style={{ '--arc-length': `${circumference}px` } as React.CSSProperties}
          />
        ) : null}
        {head ? (
          <circle
            cx={centre + radius * Math.cos(angle)}
            cy={centre + radius * Math.sin(angle)}
            r={Math.max(1.5, stroke * 0.32)}
            className={cn('arc-head', dark ? colours.head : 'fill-card')}
            style={dark ? { filter: 'drop-shadow(0 0 3px rgb(240 149 155 / 0.9))' } : undefined}
          />
        ) : null}
        {tick !== null ? (
          <line
            x1={centre + (radius - stroke * 0.9) * Math.cos(tick)}
            y1={centre + (radius - stroke * 0.9) * Math.sin(tick)}
            x2={centre + (radius + stroke * 0.9) * Math.cos(tick)}
            y2={centre + (radius + stroke * 0.9) * Math.sin(tick)}
            strokeWidth={1.5}
            strokeLinecap="round"
            className={dark ? 'stroke-nav-foreground/70' : 'stroke-foreground/55'}
          />
        ) : null}
      </svg>
      <span
        className="absolute inset-0 flex flex-col items-center justify-center"
        aria-hidden="true"
      >
        {children ?? (
          <span
            className={cn(
              'stat-figure',
              size >= 120
                ? 'text-[2rem]'
                : size >= 96
                  ? 'text-2xl'
                  : size >= 64
                    ? 'text-base'
                    : 'text-[13px]',
              dark ? 'text-nav-foreground' : 'text-foreground',
            )}
          >
            {clamped}
            <span
              className={cn(
                'ml-px text-[0.55em] font-medium',
                dark ? 'text-nav-muted' : 'text-muted-foreground',
              )}
            >
              %
            </span>
          </span>
        )}
      </span>
    </div>
  );
}
