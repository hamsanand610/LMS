'use client';

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const MIN = 28;
const MAX = 70;

/**
 * Two panes side by side with a divider the learner can drag, or move with the arrow keys once it
 * has focus. The split is remembered in this browser.
 */
export function SplitPanes({
  left,
  right,
  storageKey,
  className,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  storageKey: string;
  className?: string;
}) {
  // Only ever shown on wide screens, so this runs in the browser and can read storage at once.
  const [split, setSplit] = useState(() => {
    try {
      const stored = Number(window.localStorage.getItem(storageKey));
      if (stored >= MIN && stored <= MAX) return stored;
    } catch {
      // Storage unavailable: the default split stands.
    }
    return 44;
  });
  const container = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const set = useCallback(
    (value: number) => {
      const next = Math.max(MIN, Math.min(MAX, Math.round(value)));
      setSplit(next);
      try {
        window.localStorage.setItem(storageKey, String(next));
      } catch {
        // Not remembered, then.
      }
    },
    [storageKey],
  );

  const move = (clientX: number) => {
    const box = container.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    set(((clientX - box.left) / box.width) * 100);
  };

  return (
    <div
      ref={container}
      className={cn('grid min-h-0', className)}
      style={{ gridTemplateColumns: `minmax(0, ${split}fr) 8px minmax(0, ${100 - split}fr)` }}
    >
      <div className="min-h-0 min-w-0">{left}</div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the problem and the editor"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={split}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') set(split - 2);
          if (event.key === 'ArrowRight') set(split + 2);
        }}
        onPointerDown={(event) => {
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (dragging.current) move(event.clientX);
        }}
        onPointerUp={(event) => {
          dragging.current = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        className="group/split flex cursor-col-resize items-center justify-center outline-none"
      >
        <span className="h-12 w-1 rounded-full bg-border transition-colors group-hover/split:bg-border-strong group-focus-visible/split:bg-focus" />
      </div>
      <div className="min-h-0 min-w-0">{right}</div>
    </div>
  );
}
