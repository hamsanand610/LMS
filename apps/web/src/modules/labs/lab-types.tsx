import { Bug, Code2, Database, PanelsTopLeft, type LucideIcon } from 'lucide-react';
import type { LabType } from '@lms/shared';
import { cn } from '@/lib/utils';

/** How each kind of lab is named and drawn across the Labs (ADR-0018). */
export const LAB_TYPE_META: Record<LabType, { label: string; icon: LucideIcon; blurb: string }> = {
  coding: {
    label: 'Coding',
    icon: Code2,
    blurb: 'Write a program that turns the input into the expected output.',
  },
  sql: {
    label: 'SQL',
    icon: Database,
    blurb: 'Query a dataset in a database of your own; every run starts from the same data.',
  },
  debugging: {
    label: 'Debugging',
    icon: Bug,
    blurb: 'A program with a bug in it: find what is wrong and fix it.',
  },
  web: {
    label: 'Web',
    icon: PanelsTopLeft,
    blurb: 'Build a page with HTML, CSS and JavaScript, and see it as you go.',
  },
};

export function LabTypeBadge({ type, className }: { type: LabType; className?: string }) {
  const meta = LAB_TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1 rounded-full bg-surface-2 px-2 text-[11.5px] font-medium text-foreground-secondary',
        className,
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
