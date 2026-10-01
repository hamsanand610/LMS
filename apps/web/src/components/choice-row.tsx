import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * One answer option as a selectable row. The whole row is the target, the control inside it
 * (a checkbox or a radio) carries the choice for assistive technology, and the row's fill says
 * the same thing to the eye. After marking, the right option is named in words as well as green.
 */
export function ChoiceRow({
  control,
  children,
  selected = false,
  correct = false,
  disabled = false,
  className,
}: {
  control: React.ReactNode;
  children: React.ReactNode;
  selected?: boolean;
  /** Marked as a right answer, once the policy reveals it. */
  correct?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm leading-6 transition-colors',
        disabled ? 'cursor-default' : 'cursor-pointer',
        correct
          ? 'border-success/50 bg-success-soft text-foreground'
          : selected
            ? 'border-primary/60 bg-primary-soft/70 text-foreground dark:bg-primary-soft'
            : 'border-border text-foreground-secondary',
        !disabled &&
          !correct &&
          !selected &&
          'hover:border-border-strong hover:bg-surface-2/60 hover:text-foreground',
        className,
      )}
    >
      <span className="flex pt-1">{control}</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap">{children}</span>
      {correct ? (
        <span className="inline-flex shrink-0 items-center gap-1 pt-0.5 text-xs font-medium text-success">
          <Check className="size-3.5" aria-hidden="true" />
          Right answer
        </span>
      ) : null}
    </label>
  );
}
