'use client';

import { usePathname } from 'next/navigation';

/**
 * A short fade as each page arrives, so navigation reads as movement rather than a flash. Keyed by
 * the path, not the query string, so switching a tab or a filter does not replay it. Switched off
 * with every other animation under reduced motion (globals.css).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-in fade-in-0 duration-300 ease-out">
      {children}
    </div>
  );
}
