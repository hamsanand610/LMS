'use client';

import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { AiUsageReport } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { StatStrip } from '@/components/stat-strip';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useScrolls } from '@/components/ui/table';
import { NativeSelect } from '@/components/ui/native-select';
import { api } from '@/lib/api/http';
import { formatDateKey, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AI_KEYS } from '../queries';

export const USAGE_PERIODS = {
  month: 'This month',
  '7': 'The last 7 days',
  '30': 'The last 30 days',
  '90': 'The last 90 days',
} as const;
export type UsagePeriod = keyof typeof USAGE_PERIODS;

/** A period's query: this month is the API's own default; the others end today. */
export function usagePeriodQuery(period: UsagePeriod, today: Date): { from: string; to: string } {
  if (period === 'month') return { from: '', to: '' };
  const days = Number(period);
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  return { from: dateKey(start), to: dateKey(today) };
}

function dateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const usd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: value > 0 && value < 0.01 ? 4 : 2,
  }).format(value);

const BUDGET_TONE = {
  ok: 'text-success',
  warning: 'text-warning',
  exceeded: 'text-danger',
} as const;

/**
 * SI Academy AI's usage for a period (Phase 7E over Phase 7D's report): totals, the budget where
 * the person sees the whole institute, and figures per day and per person. It shows exactly what
 * the API returns for this person — every learner for an administrator, the learners of their
 * batches for a trainer — and never a question or an answer.
 */
export function AiUsageReport() {
  const [period, setPeriod] = useState<UsagePeriod>('month');
  const { from, to } = usagePeriodQuery(period, new Date());
  const query = useQuery({
    queryKey: AI_KEYS.usage(from, to),
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const search = params.toString();
      return api<AiUsageReport>(`/ai/usage${search ? `?${search}` : ''}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ai-usage-period">Period</Label>
          <NativeSelect
            id="ai-usage-period"
            value={period}
            onChange={(event) => setPeriod(event.target.value as UsagePeriod)}
            className="w-52"
          >
            {Object.entries(USAGE_PERIODS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
        {query.data ? (
          <p className="pb-2 text-[13px] text-muted-foreground">
            {formatDateKey(query.data.from)} – {formatDateKey(query.data.to)}
          </p>
        ) : null}
      </div>
      {query.isPending ? (
        <LoadingRows rows={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <Report report={query.data} />
      )}
    </div>
  );
}

function Report({ report }: { report: AiUsageReport }) {
  const { totals, budget } = report;
  return (
    <>
      <StatStrip
        items={[
          { label: 'Questions', value: formatNumber(totals.questions) },
          { label: 'Tokens in', value: formatNumber(totals.inputTokens) },
          { label: 'Tokens out', value: formatNumber(totals.outputTokens) },
          {
            label: 'Estimated cost',
            value: usd(totals.estimatedCostUsd),
            hint: 'From configured prices, not a bill',
          },
        ]}
      />
      {budget ? (
        <Card>
          <CardHeader>
            <CardTitle>Monthly budget</CardTitle>
            <CardDescription>
              {budget.month}: {usd(budget.spentUsd)} of {usd(budget.budgetUsd)} estimated.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="h-2 overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-label="Budget used"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, Math.round(budget.percent))}
            >
              <div
                className={cn(
                  'h-full rounded-full',
                  budget.state === 'ok'
                    ? 'bg-success'
                    : budget.state === 'warning'
                      ? 'bg-warning'
                      : 'bg-danger',
                )}
                style={{ width: `${Math.min(100, budget.percent)}%` }}
              />
            </div>
            <p className={cn('mt-2 text-sm font-medium', BUDGET_TONE[budget.state])}>
              {budget.state === 'exceeded'
                ? 'The budget is spent: questions are refused until next month.'
                : budget.state === 'warning'
                  ? `${Math.round(budget.percent)}% used: close to the budget.`
                  : `${Math.round(budget.percent)}% used.`}
            </p>
          </CardContent>
        </Card>
      ) : null}
      {report.days.length === 0 ? (
        <EmptyState
          title="No questions in this period"
          description="Usage appears here once people ask SI Academy AI."
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <UsageTable
            caption="By day"
            rows={report.days.map((day) => ({
              ...day,
              key: day.day,
              name: formatDateKey(day.day),
            }))}
            nameHeader="Day"
          />
          <UsageTable
            caption="By person"
            rows={report.people.map((person) => ({
              ...person,
              key: person.userId ?? 'erased',
              name: person.userId ? person.name : 'People whose data was erased',
            }))}
            nameHeader="Person"
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Costs are estimates from the configured prices. Figures only: no question or answer is shown
        here.
      </p>
    </>
  );
}

function UsageTable({
  caption,
  nameHeader,
  rows,
}: {
  caption: string;
  nameHeader: string;
  rows: {
    key: string;
    name: string;
    questions: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  }[];
}) {
  const box = useRef<HTMLDivElement>(null);
  const scrolls = useScrolls(box);
  return (
    <div
      ref={box}
      // On a phone the table scrolls sideways; the box is then a tab stop for the keyboard.
      tabIndex={scrolls ? 0 : undefined}
      className="overflow-x-auto rounded-xl border border-border bg-card outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <table className="w-full min-w-[440px] text-left text-sm">
        <caption className="border-b border-border px-4 py-3 text-left text-[13px] font-semibold text-foreground">
          {caption}
        </caption>
        <thead className="bg-surface-2 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">
              {nameHeader}
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Questions
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Tokens
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Est. cost
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-border">
              <td className="px-4 py-2">{row.name}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatNumber(row.questions)}</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatNumber(row.inputTokens + row.outputTokens)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{usd(row.estimatedCostUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
