import type { LucideIcon } from 'lucide-react';

/**
 * A whole-page message: access refused, nothing at this address, or a page that failed. The code
 * sits large and faint behind the words, so the page has presence without a picture, and the one
 * useful way on is the button under them.
 */
export function StatusPage({
  code,
  label,
  icon: Icon,
  title,
  children,
  actions,
}: {
  /** "403", "404"; decorative, the label carries the meaning. */
  code: string;
  label: string;
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center justify-center overflow-hidden bg-background px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="font-display pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[62%] text-[11rem] leading-none text-foreground/[0.05] select-none sm:text-[17rem]"
      >
        {code}
      </span>
      <div className="relative flex max-w-md flex-col items-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-card text-foreground-secondary shadow-sm ring-1 ring-border">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <p className="eyebrow mt-6">{label}</p>
        <h1 className="font-display mt-2 text-[2.25rem] leading-[1.05] text-balance text-foreground">
          {title}
        </h1>
        <div className="mt-3 text-[15px] leading-relaxed text-pretty text-muted-foreground">
          {children}
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2">{actions}</div>
      </div>
    </main>
  );
}
