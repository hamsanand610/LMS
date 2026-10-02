'use client';

import { KeyRound, Lock, Wrench } from 'lucide-react';
import { DIFFICULTY_LABELS, type PracticeProblemDetail, type SqlSchemaTable } from '@lms/shared';
import { plural } from '@/lib/format';
import { InlineText, ProblemStatement, RichText } from '@/modules/workspace/statement';
import { LAB_TYPE_META } from './lab-types';

/**
 * A lab's statement: the problem as written, and what its kind adds — the dataset's tables for
 * SQL, what the fixed program should do for debugging, the checks for a web page.
 */
export function LabStatement({
  problem,
  eyebrow,
}: {
  problem: PracticeProblemDetail;
  eyebrow: string;
}) {
  const web = problem.type === 'web';
  return (
    <ProblemStatement
      problem={{
        eyebrow,
        title: problem.title,
        facts: [
          `${LAB_TYPE_META[problem.type].label} lab`,
          DIFFICULTY_LABELS[problem.difficulty] ?? problem.difficulty,
          plural(problem.points, 'point'),
          ...(problem.status === 'solved' ? ['Solved'] : []),
        ],
        type: problem.type,
        body: problem.body,
        hints: problem.hints,
        spec: null,
        coding: web
          ? null
          : {
              inputFormat: problem.inputFormat,
              outputFormat: problem.outputFormat,
              constraints: problem.constraints,
              compareMode: problem.compareMode,
              schemaSql: problem.schemaSql,
              samples: problem.samples,
              hiddenCount: problem.hiddenTestCount,
              timeLimitMs: problem.timeLimitMs,
              memoryLimitMb: problem.memoryLimitMb,
            },
      }}
    >
      {problem.type === 'debugging' ? <Debugging problem={problem} /> : null}
      {problem.type === 'sql' ? <SchemaBrowser tables={problem.sqlSchema} /> : null}
      {web ? <WebChecks problem={problem} /> : null}
    </ProblemStatement>
  );
}

function Debugging({ problem }: { problem: PracticeProblemDetail }) {
  return (
    <section className="space-y-2 rounded-lg border border-warning/30 bg-warning-soft/40 px-4 py-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Wrench className="size-4 text-warning" aria-hidden="true" />
        What the program should do
      </h3>
      <RichText text={problem.expectedBehaviour} className="text-sm leading-6" />
      <p className="text-xs text-muted-foreground">
        The code in the editor has a bug. Run it, find what is wrong, and fix it. Reset brings back
        the code you started with.
      </p>
    </section>
  );
}

/** The dataset's tables and columns, read in the sandbox (ADR-0020). */
export function SchemaBrowser({ tables }: { tables: SqlSchemaTable[] | null }) {
  if (!tables || tables.length === 0) return null;
  return (
    <section className="space-y-2" aria-labelledby="schema-heading">
      <h3 id="schema-heading" className="text-sm font-semibold text-foreground">
        Tables and columns
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {tables.map((table) => (
          <div key={table.name} className="rounded-lg border border-border bg-card">
            <p className="border-b border-border px-3 py-1.5 font-mono text-[12.5px] font-semibold">
              {table.name}
            </p>
            <ul className="px-3 py-1.5 font-mono text-[12px] leading-6">
              {table.columns.map((column) => (
                <li key={column.name} className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1">
                    {column.primaryKey ? (
                      <KeyRound className="size-3 text-achievement" aria-label="Primary key" />
                    ) : null}
                    {column.name}
                  </span>
                  <span className="text-muted-foreground">
                    {column.type || 'any'}
                    {column.notNull && !column.primaryKey ? ' · required' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Every run starts from this data in a database of its own, so nothing you change is kept
        between runs. The database is SQLite: standard SQL, joins, grouping, window functions and
        common table expressions all work.
      </p>
    </section>
  );
}

function WebChecks({ problem }: { problem: PracticeProblemDetail }) {
  return (
    <section className="space-y-2" aria-labelledby="checks-heading">
      <h3 id="checks-heading" className="text-sm font-semibold text-foreground">
        What is checked
      </h3>
      {problem.checks.length > 0 ? (
        <ol className="space-y-1.5">
          {problem.checks.map((check) => (
            <li
              key={check.id}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <span className="block font-medium">{check.label}</span>
              <span className="block text-xs text-muted-foreground">
                <InlineText text={check.description} />
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {problem.hiddenTestCount > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden="true" />
          {plural(problem.hiddenTestCount, 'more check')}{' '}
          {problem.hiddenTestCount === 1 ? 'is' : 'are'} hidden. A submission is checked against{' '}
          {problem.hiddenTestCount === 1 ? 'it' : 'them'} as well.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Checks run in the sandbox on a fresh copy of your page; the preview only shows it. There is
        no layout engine there, so checks read structure, text, attributes, styles and what the page
        logs, not positions or sizes on screen. Your page cannot load anything from the internet.
      </p>
    </section>
  );
}
