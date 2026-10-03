'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  ChevronRight,
  ClipboardList,
  FileQuestion,
  FileText,
  FlaskConical,
  GraduationCap,
  Layers,
  Megaphone,
  Paperclip,
  Search,
  Timer,
  UserCog,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { SearchResponse, SearchType } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { controlClass } from '@/components/ui/input';
import { api } from '@/lib/api/http';
import { cn } from '@/lib/utils';

const TYPE_ICON: Record<SearchType, LucideIcon> = {
  student: GraduationCap,
  trainer: UserRound,
  batch: Users,
  program: Layers,
  user: UserCog,
  course: BookOpen,
  lesson: FileText,
  assignment: ClipboardList,
  practice: FlaskConical,
  test: Timer,
  announcement: Megaphone,
  question: FileQuestion,
  document: Paperclip,
};

/** The title with the searched-for term marked, so the eye finds why each row matched. */
function Highlighted({ text, term }: { text: string; term: string }) {
  const needle = term.trim();
  if (needle.length < 2) return <>{text}</>;
  const lower = text.toLowerCase();
  const target = needle.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  let at = lower.indexOf(target, from);
  while (at !== -1) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(
      <mark key={at} className="rounded-sm bg-primary-soft px-0.5 text-foreground">
        {text.slice(at, at + needle.length)}
      </mark>,
    );
    from = at + needle.length;
    at = lower.indexOf(target, from);
  }
  if (from < text.length) parts.push(text.slice(from));
  return <>{parts}</>;
}

/**
 * The full results page behind the command palette (plan DP-S23). It returns only what the caller
 * is allowed to see — the API does the filtering, not the page.
 */
export function SearchResults() {
  const params = useSearchParams();
  const router = useRouter();
  const [term, setTerm] = useState(() => params.get('q') ?? '');
  const [submitted, setSubmitted] = useState(() => params.get('q') ?? '');

  const query = useQuery({
    queryKey: ['search', submitted],
    queryFn: () => api<SearchResponse>(`/search?q=${encodeURIComponent(submitted)}&limit=20`),
    enabled: submitted.trim().length >= 2,
  });

  return (
    <div className="space-y-8">
      <form
        role="search"
        className="flex max-w-2xl gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(term);
          // The query stays in the address, so the results can be shared, reloaded and gone back to.
          router.replace(`/search?q=${encodeURIComponent(term.trim())}`, { scroll: false });
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="A course, a lesson, a lab, a name…"
            aria-label="Search"
            className={cn(controlClass, 'h-11 pr-3 pl-10')}
          />
        </div>
        <Button type="submit" size="lg" disabled={term.trim().length < 2}>
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
          <div className="space-y-8">
            <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
              {query.data.total} {query.data.total === 1 ? 'result' : 'results'} for “{submitted}”
            </p>
            {query.data.groups.map((group) => {
              const Icon = TYPE_ICON[group.type] ?? Search;
              return (
                <section key={group.type} aria-labelledby={`group-${group.type}`}>
                  <h2
                    id={`group-${group.type}`}
                    className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"
                  >
                    {group.label}
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                      {group.hits.length}
                    </span>
                  </h2>
                  <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                    {group.hits.map((hit) => (
                      <li key={`${hit.type}-${hit.id}`}>
                        <Link
                          href={hit.route}
                          className="group/hit flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60 focus-visible:bg-surface-2/60"
                        >
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted-foreground">
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              <Highlighted text={hit.title} term={submitted} />
                            </span>
                            {hit.subtitle ? (
                              <span className="block truncate text-xs text-muted-foreground">
                                {hit.subtitle}
                              </span>
                            ) : null}
                          </span>
                          <ChevronRight
                            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/hit:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )
      ) : null}
    </div>
  );
}
