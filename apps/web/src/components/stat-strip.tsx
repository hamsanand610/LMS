import { cn } from '@/lib/utils';

export interface StatItem {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'default' | 'warning' | 'danger' | 'success';
}

const TONE = {
  default: 'text-foreground',
  warning: 'text-warning',
  danger: 'text-danger',
  success: 'text-success',
} as const;

/**
 * Summary figures as one band with hairline dividers, not a row of look-alike cards. The divider
 * trick (a 1px gap over the border colour) keeps the lines right at any count: the cells wrap and
 * grow, so a short last row stretches instead of leaving a hole.
 */
export function StatStrip({ items, className }: { items: StatItem[]; className?: string }) {
  return (
    <dl
      className={cn(
        'flex flex-wrap gap-px overflow-hidden rounded-xl border border-border bg-border shadow-xs',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0 flex-1 basis-36 bg-card px-5 py-4">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className={cn('stat-figure mt-2 text-[1.75rem]', TONE[item.tone ?? 'default'])}>
            {item.value}
          </dd>
          {item.hint ? <dd className="mt-0.5 text-xs text-muted-foreground">{item.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
