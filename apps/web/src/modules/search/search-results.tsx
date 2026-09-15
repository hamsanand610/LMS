'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { SearchResponse } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api/http';

/**
 * The full results page behind the command palette (plan DP-S23). It returns only what the caller
 * is allowed to see — the API does the filtering, not the page.
 */
export function SearchResults() {
  const params = useSearchParams();
  const [term, setTerm] = useState(() => params.get('q') ?? '');
  const [submitted, setSubmitted] = useState(() => params.get('q') ?? '');

  const query = useQuery({
    queryKey: ['search', submitted],
    queryFn: () => api<SearchResponse>(`/search?q=${encodeURIComponent(submitted)}&limit=20`),
    enabled: submitted.trim().length >= 2,
  });

  return (
    <div className="space-y-6">
      <form
        className="flex max-w-xl gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(term);
        }}
      >
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search for a person, a batch, a course…"
          aria-label="Search"
        />
        <Button type="submit" disabled={term.trim().length < 2}>
          Search
        </Button>
      </form>

      {submitted.trim().length < 2 ? (
        <EmptyState
          title="What are you looking for?"
          description="Type at least two characters. You will only ever see what you are allowed to see."
        />
      ) : null}

      {query.isPending && submitted.trim().length >= 2 ? <LoadingRows rows={5} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}

      {query.data ? (
        query.data.total === 0 ? (
          <EmptyState
            title={`Nothing matches “${submitted}”`}
            description="Try a shorter term, or a code rather than a name."
          />
        ) : (
          <div className="space-y-6">
            {query.data.groups.map((group) => (
              <section key={group.type}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  {group.label}
                  <Badge className="bg-muted text-muted-foreground">{group.hits.length}</Badge>
                </h2>
                <ul className="space-y-2">
                  {group.hits.map((hit) => (
                    <li key={`${hit.type}-${hit.id}`}>
                      <Link
                        href={hit.route}
                        className="block rounded-lg border border-border p-3 transition-colors hover:border-primary"
                      >
                        <p className="font-medium">{hit.title}</p>
                        {hit.subtitle ? (
                          <p className="text-xs text-muted-foreground">{hit.subtitle}</p>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
