import { cn } from '@/lib/utils';

/**
 * A technology's mark: a short monogram on a tile with a hairline of colour from the chart palette.
 * Deliberately not a product logo — logos are other people's trademarks, and a monogram stays
 * legible at 32 px in both themes.
 */
const MARKS: Record<string, { text: string; slot: 1 | 2 | 3 | 4 | 5 | 6 }> = {
  java: { text: 'Jv', slot: 1 },
  'core-java': { text: 'Jv', slot: 1 },
  'advanced-java': { text: 'EE', slot: 1 },
  spring: { text: 'Sp', slot: 6 },
  'spring-boot': { text: 'SB', slot: 6 },
  hibernate: { text: 'Hb', slot: 5 },
  python: { text: 'Py', slot: 2 },
  javascript: { text: 'JS', slot: 3 },
  frontend: { text: 'FE', slot: 3 },
  react: { text: 'Rx', slot: 2 },
  'html-css': { text: '</>', slot: 5 },
  html: { text: '</>', slot: 5 },
  css: { text: '{ }', slot: 5 },
  sql: { text: 'SQL', slot: 4 },
  mysql: { text: 'SQL', slot: 4 },
  php: { text: 'PHP', slot: 5 },
  dsa: { text: 'DS', slot: 6 },
  programming: { text: 'fn', slot: 6 },
  git: { text: 'Git', slot: 3 },
  testing: { text: 'QA', slot: 4 },
  deployment: { text: 'Ops', slot: 2 },
  'ai-tools': { text: 'AI', slot: 5 },
  aptitude: { text: 'Ap', slot: 4 },
  'soft-skills': { text: 'Ss', slot: 3 },
  career: { text: 'Cv', slot: 3 },
};

export function TechMark({
  technology,
  label,
  size = 'md',
  className,
}: {
  technology: string;
  /** The technology's name, for the accessible label. */
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const mark = MARKS[technology] ?? {
    text:
      (technology || '?')
        .replace(/[^a-z]/gi, '')
        .slice(0, 2)
        .replace(/^\w/, (c) => c.toUpperCase()) || '?',
    slot: 6 as const,
  };
  return (
    <span
      role="img"
      aria-label={label ?? technology}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2 font-mono font-semibold text-foreground',
        size === 'md' ? 'size-10 text-[12px]' : 'size-8 text-[11px]',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ backgroundColor: `var(--chart-${mark.slot})` }}
      />
      <span aria-hidden="true">{mark.text}</span>
    </span>
  );
}
