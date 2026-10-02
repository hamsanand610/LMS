'use client';

import { useQuery } from '@tanstack/react-query';
import { Briefcase, Circle, CircleCheck, CircleDot, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { CompanyDetail, KitItemStatus, KitItemView } from '@lms/shared';
import { DifficultyBadge } from '@/components/difficulty-badge';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { ProgressRing } from '@/components/progress-ring';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/http';
import { humanise } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/shell/page-header';
import { CompanyLogo } from './company-logo';
import { FavouriteButton } from './interview-prep';

const STATUS: Record<KitItemStatus, { label: string; icon: typeof Circle; className: string }> = {
  solved: { label: 'Solved', icon: CircleCheck, className: 'text-success' },
  attempted: { label: 'Attempted', icon: CircleDot, className: 'text-warning' },
  not_started: { label: 'Not started', icon: Circle, className: 'text-muted-foreground' },
};

function byTopic(kit: KitItemView[]): { topic: string; items: KitItemView[] }[] {
  const groups = new Map<string, KitItemView[]>();
  for (const item of kit) {
    const topic = item.topic || 'General';
    groups.set(topic, [...(groups.get(topic) ?? []), item]);
  }
  return [...groups.entries()].map(([topic, items]) => ({ topic, items }));
}

/**
 * One company's kit, topic by topic. Each question opens in its lab, where a solution is judged
 * and counted like any other lab.
 */
export function CompanyKit({ slug }: { slug: string }) {
  const key = ['company', slug];
  const query = useQuery({
    queryKey: key,
    queryFn: () => api<CompanyDetail>(`/companies/${slug}`),
  });

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const company = query.data;
  const pct = company.kitSize > 0 ? Math.round((company.solved / company.kitSize) * 100) : 0;

  return (
    <>
      <PageHeader
        back={{ href: '/interview-prep', label: 'Interview prep' }}
        eyebrow={company.industry || 'Company'}
        title={company.name}
        description={company.description || undefined}
        meta={
          <div className="flex flex-wrap items-center gap-3">
            {company.technologies.map((tech) => (
              <span
                key={tech}
                className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-foreground-secondary"
              >
                {humanise(tech)}
              </span>
            ))}
            {company.website ? (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline"
              >
                Website
                <ExternalLink className="size-3.5" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            ) : null}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <FavouriteButton company={company} queryKeys={[key, ['companies']]} />
            {company.openDrives > 0 ? (
              <Button asChild>
                <Link href={`/placements?companyId=${company.id}`}>
                  <Briefcase aria-hidden="true" />
                  Open drives ({company.openDrives})
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="order-2 space-y-5 lg:order-1">
          {company.kit.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border-strong/80 px-5 py-8 text-center text-sm text-muted-foreground">
              The kit for {company.name} is still being put together.
            </p>
          ) : (
            byTopic(company.kit).map((group) => (
              <section key={group.topic} aria-labelledby={`topic-${group.topic}`}>
                <h2
                  id={`topic-${group.topic}`}
                  className="mb-2 text-[13px] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
                >
                  {group.topic}
                  <span className="ml-2 font-normal tracking-normal normal-case">
                    {group.items.filter((i) => i.status === 'solved').length} / {group.items.length}
                  </span>
                </h2>
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                  {group.items.map((item) => {
                    const status = STATUS[item.status];
                    const Icon = status.icon;
                    return (
                      <li key={item.questionId}>
                        <Link
                          href={`/labs/${item.slug}`}
                          className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-surface-2/60"
                        >
                          <Icon
                            className={cn('size-4 shrink-0', status.className)}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-foreground">
                              {item.title}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {status.label}
                              {item.attempts > 0
                                ? ` · ${item.attempts} ${item.attempts === 1 ? 'run' : 'runs'}`
                                : ''}{' '}
                              · {item.points} points
                            </span>
                          </span>
                          <DifficultyBadge value={item.difficulty} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
        <aside className="order-1 rounded-xl border border-border bg-card p-5 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:order-2">
          <div className="flex items-center gap-4">
            <CompanyLogo name={company.name} logoUrl={company.logoUrl} size="lg" />
            <ProgressRing value={pct} size={64} stroke={6} label={`${pct}% of the kit solved`} />
          </div>
          <p className="mt-4 text-sm font-semibold text-foreground">
            {company.solved} of {company.kitSize} solved
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Solutions run in an isolated sandbox and are judged against the problem’s own test
            cases, hidden ones included, the same as every lab. Points count once, the first time
            you solve a problem.
          </p>
        </aside>
      </div>
    </>
  );
}
