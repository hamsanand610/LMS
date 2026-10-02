'use client';

import { useEffect, useRef, useState } from 'react';
import { readPreviewMessage, type PreviewLevel } from '@/lib/labs/web-preview';
import { cn } from '@/lib/utils';

const MAX_LINES = 300;

export interface ConsoleLine {
  level: PreviewLevel;
  text: string;
}

/**
 * The learner's page, shown and never judged (ADR-0019). The frame is sandboxed with scripts
 * only: its origin is opaque, so it has no cookies, storage or session of the app, cannot reach
 * the app's pages or its API, cannot submit forms, open windows or navigate the tab. Its own policy
 * forbids every fetch. What it logs arrives as messages, accepted only from this frame and shown
 * as text.
 */
export function WebPreviewFrame({
  document: srcDoc,
  runKey,
  onConsole,
  className,
}: {
  /** The assembled document (buildPreviewDocument); null before the first preview. */
  document: string | null;
  /** Changes on every Run, so the page loads afresh even when its text has not changed. */
  runKey: number;
  onConsole: (line: ConsoleLine) => void;
  className?: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const report = useRef(onConsole);
  useEffect(() => {
    report.current = onConsole;
  });

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      // Only this frame's own messages; any other window's are ignored.
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const message = readPreviewMessage(event.data);
      if (message) report.current({ level: message.level, text: message.text });
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);

  if (srcDoc === null) {
    return (
      <div
        className={cn(
          'flex h-full min-h-[200px] items-center justify-center bg-surface-2/40 p-6 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        Press Run to see your page here.
      </div>
    );
  }
  return (
    <iframe
      key={runKey}
      ref={frame}
      title="Preview of your page"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      referrerPolicy="no-referrer"
      className={cn('h-full min-h-[200px] w-full border-0 bg-white', className)}
    />
  );
}

/** What the page logged, newest last, as text. */
export function PreviewConsole({ lines, className }: { lines: ConsoleLine[]; className?: string }) {
  if (lines.length === 0) {
    return (
      <p className={cn('px-3 py-2 text-xs text-muted-foreground', className)}>
        Nothing logged. What your page prints with console.log appears here.
      </p>
    );
  }
  return (
    <ol
      className={cn('divide-y divide-border/60 font-mono text-[12px] leading-5', className)}
      aria-label="What your page logged"
    >
      {lines.map((line, index) => (
        <li
          key={index}
          className={cn(
            'px-3 py-1 break-words whitespace-pre-wrap',
            line.level === 'error' && 'bg-danger-soft/40 text-danger',
            line.level === 'warn' && 'bg-warning-soft/40 text-warning',
          )}
        >
          {line.text}
        </li>
      ))}
    </ol>
  );
}

/** Keeps the latest lines, so a page that logs in a loop cannot fill the tab's memory. */
export function useConsoleLines() {
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  return {
    lines,
    add: (line: ConsoleLine) =>
      setLines((current) =>
        current.length >= MAX_LINES ? [...current.slice(1), line] : [...current, line],
      ),
    clear: () => setLines([]),
  };
}
