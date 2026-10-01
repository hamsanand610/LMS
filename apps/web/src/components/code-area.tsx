import { cn } from '@/lib/utils';

/**
 * A plain-text code field on the ink surface, the same plane as the navigation rail. It is a
 * textarea that looks the part, not an IDE: monospace, no spellcheck or autocorrect, four-space
 * tabs. Tab still moves focus, so a keyboard user is never trapped inside it.
 */
export function CodeArea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="code-area"
      spellCheck={false}
      autoCapitalize="off"
      autoComplete="off"
      autoCorrect="off"
      // Code keeps its lines: a long one scrolls sideways rather than wrapping into a false break.
      wrap="off"
      className={cn(
        'block w-full resize-y bg-nav px-4 py-3 font-mono text-[13px] leading-6 text-nav-foreground caret-nav-accent outline-none [tab-size:4] placeholder:text-nav-muted selection:bg-nav-accent/30 disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}

/** The frame around a code field: a toolbar strip, then the field; focus shows on the frame. */
export function CodeFrame({
  toolbar,
  children,
  className,
}: {
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border-strong bg-nav shadow-xs transition-[border-color,box-shadow] focus-within:border-focus focus-within:ring-3 focus-within:ring-focus/25',
        className,
      )}
    >
      {toolbar ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-2 px-3 py-2">
          {toolbar}
        </div>
      ) : null}
      {children}
    </div>
  );
}
