'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Star } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { CompanyCard } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Progress } from '@/components/ui/progress';
import { SearchInput } from '@/components/ui/search-input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { humanise } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CompanyLogo } from './company-logo';

type View = 'all' | 'in_progress' | 'completed' | 'favourites';

const VIEWS: { value: View; label: string }[] = [
  { value: 'all', label: 'All companies' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'favourites', label: 'Starred' },
];

export function FavouriteButton({
  company,
  queryKeys,
  className,
}: {
  company: Pick<CompanyCard, 'id' | 'name' | 'isFavourite'>;
  queryKeys: unknown[][];
  className?: string;
}) {
  const client = useQueryClient();
  const toggle = useMutation({
    mutationFn: () =>
      api(`/companies/${company.id}/favourite`, {
        method: company.isFavourite ? 'DELETE' : 'PUT',
      }),
    onSuccess: async () => {
      await Promise.all(queryKeys.map((key) => client.invalidateQueries({ queryKey: key })));
    },
    onError: (error: Error) => toast.error(isApiError(error) ? error.message : 'That did not save'),
  });
  return (
    <button
      type="button"
      aria-pressed={company.isFavourite}
      aria-label={company.isFavourite ? `Unstar ${company.name}` : `Star ${company.name}`}
      disabled={toggle.isPending}
      onClick={(event) => {
        event.preventDefault();
        toggle.mutate();
      }}
      className={cn(
        'relative z-10 flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus',
        company.isFavourite && 'text-warning hover:text-warning',
        className,
      )}
    >
      <Star className={cn('size-4', company.isFavourite && 'fill-current')} aria-hidden="true" />
    </button>
  );
}

/**
 * Interview preparation by company: each company's kit is a set of practice problems chosen for the
 * way it interviews. Solving one counts exactly as practice does.
 */
export function InterviewPrep() {
  const [view, setView] = useState<View>('all');
  const [q, setQ] = useState('');
  const [technology, setTechnology] = useState<string | null>(null);
  const params = new URLSearchParams({ view });
  if (q.trim()) params.set('q', q.trim());
  if (technology) params.set('technology', technology);
  const key = ['companies', params.toString()];
  const query = useQuery({
    queryKey: key,
    queryFn: () => api<CompanyCard[]>(`/companies?${params.toString()}`),
  });
  // The technology chips come from the whole list, so choosing one does not hide the others.
  const all = useQuery({
    queryKey: ['companies', 'view=all'],
    queryFn: () => api<CompanyCard[]>('/companies?view=all'),
  });
  const technologies = useMemo(
    () => [...new Set((all.data ?? []).flatMap((c) => c.technologies))].sort(),
    [all.data],
  );
  const solved = (all.data ?? []).reduce((n, c) => n + c.solved, 0);
  const total = (all.data ?? []).reduce((n, c) => n + c.kitSize, 0);

  return (
    <div className="space-y-5">
      {all.data && total > 0 ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{solved}</span> of{' '}
          <span className="tabular-nums">{total}</span> kit questions solved across{' '}
          {all.data.length} companies.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs filter value={view} onValueChange={(value) => setView(value as View)}>
          <TabsList variant="segmented" aria-label="Show">
            {VIEWS.map((v) => (
              <TabsTrigger key={v.value} value={v.value}>
                {v.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <SearchInput
          wrapperClassName="w-full sm:w-64"
          placeholder="Search companies"
          aria-label="Search companies"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {technologies.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by technology">
          <button
            type="button"
            aria-pressed={technology === null}
            onClick={() => setTechnology(null)}
            className={chipClass(technology === null)}
          >
            Any technology
          </button>
          {technologies.map((tech) => (
            <button
              key={tech}
              type="button"
              aria-pressed={technology === tech}
              onClick={() => setTechnology(technology === tech ? null : tech)}
              className={chipClass(technology === tech)}
            >
              {humanise(tech)}
            </button>
          ))}
        </div>
      ) : null}

      {query.isPending ? <LoadingRows rows={4} /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState
          title={view === 'favourites' ? 'No starred companies' : 'No companies match'}
          description={
            view === 'favourites'
              ? 'Star a company to keep its kit one tap away.'
              : 'Your institute adds companies and their interview-prep kits here.'
          }
        />
      ) : null}

      {query.data && query.data.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {query.data.map((company) => {
            const pct =
              company.kitSize > 0 ? Math.round((company.solved / company.kitSize) * 100) : 0;
            return (
              <li key={company.id}>
                <article className="group/card relative flex h-full flex-col gap-4 rounded-xl border border-border bg-card p-5 transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <CompanyLogo name={company.name} logoUrl={company.logoUrl} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-foreground">
                        <Link
                          href={`/interview-prep/${company.slug}`}
                          className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-focus"
                        >
                          {company.name}
                        </Link>
                      </h3>
                      <p className="truncate text-xs text-muted-foreground">
                        {company.industry || 'Company'}
                      </p>
                    </div>
                    <FavouriteButton company={company} queryKeys={[['companies']]} />
                  </div>
                  {company.technologies.length > 0 ? (
                    <ul className="flex flex-wrap gap-1" aria-label="Technologies">
                      {company.technologies.slice(0, 5).map((tech) => (
                        <li
                          key={tech}
                          className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-foreground-secondary"
                        >
                          {humanise(tech)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-auto space-y-2">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-muted-foreground tabular-nums">
                        {company.kitSize === 0
                          ? 'Kit being prepared'
                          : `${company.solved} of ${company.kitSize} solved`}
                      </span>
                      {company.openDrives > 0 ? (
                        <span className="inline-flex items-center gap-1 font-medium text-brand">
                          <Briefcase className="size-3.5" aria-hidden="true" />
                          Hiring now
                        </span>
                      ) : null}
                    </div>
                    <Progress
                      value={pct}
                      aria-label={`${company.name}: ${pct}% of the kit solved`}
                    />
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function chipClass(active: boolean): string {
  return cn(
    'rounded-full border px-3 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus',
    active
      ? 'border-primary bg-primary text-primary-foreground'
      : 'border-border bg-card text-foreground-secondary hover:border-border-strong hover:text-foreground',
  );
}
