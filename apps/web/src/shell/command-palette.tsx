'use client';

import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { SearchHit, SearchResponse } from '@lms/shared';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
      {/* One trigger, two shapes: an icon on phones, a labelled box with the shortcut on desktop. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:h-auto md:w-auto md:gap-2 md:rounded-md md:border md:border-border md:px-3 md:py-1.5 md:text-sm"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="hidden md:inline">Search</span>
        <kbd className="hidden rounded border border-border px-1 text-[10px] md:inline">Ctrl K</kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-24 max-w-xl translate-y-0 p-0">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <div className="border-b border-border p-3">
            <Input
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
              placeholder="Search students, trainers, batches…"
              aria-label="Search term"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {query.length < 2 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                Type at least two characters.
              </p>
            ) : results.isPending ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Searching…</p>
            ) : hits.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                Nothing matches “{query}”.
              </p>
            ) : (
              results.data!.groups.map((group) => (
                <div key={group.type} className="mb-2">
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                  <ul>
                    {group.hits.map((hit) => {
                      const index = hits.indexOf(hit);
                      return (
                        <li key={`${hit.type}-${hit.id}`}>
                          <button
                            type="button"
                            onClick={() => go(hit)}
                            onMouseEnter={() => setHighlighted(index)}
                            className={cn(
                              'flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left',
                              index === highlighted ? 'bg-muted' : 'hover:bg-muted',
                            )}
                          >
                            <span className="text-sm">{hit.title}</span>
                            <span className="text-xs text-muted-foreground">{hit.subtitle}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
