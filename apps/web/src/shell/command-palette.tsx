'use client';

import { useQuery } from '@tanstack/react-query';
import { CornerDownLeft, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { SearchHit, SearchResponse } from '@lms/shared';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api/http';
import { cn } from '@/lib/utils';

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface px-1 font-sans text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

/** Ctrl/⌘+K search across the records the signed-in person is allowed to see. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const query = useDebounced(term.trim(), 250);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const results = useQuery({
    queryKey: ['search', query],
    queryFn: () => api<SearchResponse>(`/search?q=${encodeURIComponent(query)}`),
    enabled: open && query.length >= 2,
    staleTime: 10_000,
  });

  const hits: SearchHit[] = results.data?.groups.flatMap((group) => group.hits) ?? [];
  const go = (hit: SearchHit) => {
    setOpen(false);
    setTerm('');
    router.push(hit.route);
  };

  return (
    <>
      {/* One trigger, two shapes: an icon on phones, an input-like field with its shortcut on desktop. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        aria-keyshortcuts="Control+K Meta+K"
        className="inline-flex size-9 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-surface-2 hover:text-foreground md:h-9 md:w-60 md:justify-start md:gap-2.5 md:border md:border-border md:bg-surface md:px-3 md:text-sm md:text-muted-foreground md:shadow-xs md:hover:border-border-strong md:hover:bg-surface lg:w-72"
      >
        <Search className="size-[18px] md:size-4" aria-hidden="true" />
        <span className="hidden flex-1 text-left md:inline">Search…</span>
        <span className="hidden items-center gap-0.5 md:inline-flex" aria-hidden="true">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="glass top-[12vh] max-w-[calc(100%-1.5rem)] translate-y-0 gap-0 overflow-hidden rounded-2xl border border-(--glass-border) p-0 shadow-xl sm:max-w-xl"
        >
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">
            Find people, batches, courses and more. Use the arrow keys to move and Enter to open.
          </DialogDescription>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              autoFocus
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setHighlighted(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlighted((i) => Math.min(i + 1, hits.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlighted((i) => Math.max(i - 1, 0));
                } else if (e.key === 'Enter' && hits[highlighted]) {
                  e.preventDefault();
                  go(hits[highlighted]);
                }
              }}
              placeholder="Search students, trainers, batches, courses…"
              aria-label="Search term"
              className="h-14 w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-[15px]"
            />
            <Kbd>Esc</Kbd>
          </div>
          <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-2" aria-live="polite">
            {query.length < 2 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                Type at least two characters.
              </p>
            ) : results.isPending ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">Searching…</p>
            ) : hits.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                Nothing matches “{query}”.
              </p>
            ) : (
              results.data!.groups.map((group) => (
                <div key={group.type} className="mb-1.5 last:mb-0">
                  <p className="eyebrow px-3 pt-2 pb-1.5">{group.label}</p>
                  <ul>
                    {group.hits.map((hit) => {
                      const index = hits.indexOf(hit);
                      const active = index === highlighted;
                      return (
                        <li key={`${hit.type}-${hit.id}`}>
                          <button
                            type="button"
                            onClick={() => go(hit)}
                            onMouseEnter={() => setHighlighted(index)}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                              active ? 'bg-surface-2' : 'hover:bg-surface-2/70',
                            )}
                          >
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-sm font-medium text-foreground">
                                {hit.title}
                              </span>
                              <span className="truncate text-xs text-muted-foreground">
                                {hit.subtitle}
                              </span>
                            </span>
                            <CornerDownLeft
                              aria-hidden="true"
                              className={cn(
                                'size-3.5 shrink-0 text-muted-foreground transition-opacity',
                                active ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>
          <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> to move
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>Enter</Kbd> to open
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
