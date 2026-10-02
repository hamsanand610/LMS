'use client';

import { Lightbulb, Lock } from 'lucide-react';
import { useState } from 'react';
import {
  DIFFICULTY_LABELS,
  QUESTION_TYPE_LABELS,
  type CompareMode,
  type LearnerQuestionWorkspace,
  type QuestionSpec,
  type QuestionType,
} from '@lms/shared';
import { Button } from '@/components/ui/button';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ResultTable } from './result-table';

/**
 * Question text as written by staff: paragraphs, with ``` fences as code blocks and `backticks`
 * as inline code. Rendered as text nodes only — nothing in it is interpreted as HTML.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/```[a-z0-9+#-]*\n?/i);
  return (
    <div className={cn('space-y-3 text-[15px] leading-7 text-foreground', className)}>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <pre
            key={index}
            className="overflow-x-auto rounded-lg border border-border bg-surface-2/70 px-4 py-3 font-mono text-[13px] leading-6"
          >
            {part.replace(/\n$/, '')}
          </pre>
        ) : (
          part
            .split(/\n{2,}/)
            .filter((paragraph) => paragraph.trim())
            .map((paragraph, p) => (
              <p key={`${index}-${p}`} className="whitespace-pre-line">
                <InlineText text={paragraph} />
              </p>
            ))
        ),
      )}
    </div>
  );
}

/**
 * Text with `inline code` set in mono, as React text (never HTML). It renders no block elements,
 * so it can sit inside a paragraph: explanations, notes and case descriptions.
 */
export function InlineText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`\n]+`)/).map((chunk, c) =>
        chunk.startsWith('`') && chunk.endsWith('`') && chunk.length > 2 ? (
          <code key={c} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.9em]">
            {chunk.slice(1, -1)}
          </code>
        ) : (
          chunk
        ),
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Block({ text }: { text: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-surface-2/70 px-3 py-2 font-mono text-[12.5px] leading-5 whitespace-pre">
      {text === '' ? <span className="text-muted-foreground">(no input)</span> : text}
    </pre>
  );
}

/** A problem as the statement shows it, whichever page it comes from. */
export interface ProblemView {
  eyebrow: string;
  title: string;
  /** Short facts under the title: the type, the level, the marks or points. */
  facts: string[];
  type: QuestionType;
  body: string;
  hints: string[];
  spec: QuestionSpec | null;
  coding: {
    inputFormat: string;
    outputFormat: string;
    constraints: string;
    compareMode: CompareMode;
    schemaSql: string;
    samples: {
      id: string;
      label: string;
      input: string;
      expectedOutput: string;
      explanation: string;
    }[];
    hiddenCount: number;
    timeLimitMs: number;
    memoryLimitMb: number;
  } | null;
}

/** Everything the learner reads before answering an assignment question. */
export function Statement({ workspace }: { workspace: LearnerQuestionWorkspace }) {
  const { question, placement, progress } = workspace;
  return (
    <ProblemStatement
      problem={{
        eyebrow: `${placement.moduleTitle} · Question ${placement.index} of ${placement.count}`,
        title: question.title,
        facts: [
          QUESTION_TYPE_LABELS[question.type],
          DIFFICULTY_LABELS[question.difficulty] ?? question.difficulty,
          plural(placement.marks, 'mark'),
          ...(progress.attemptsLeft !== null
            ? [`${plural(progress.attemptsLeft, 'attempt')} left`]
            : []),
        ],
        type: question.type,
        body: question.body,
        hints: question.hints,
        spec: question.spec,
        coding: question.coding,
      }}
    />
  );
}

export function ProblemStatement({
  problem,
  children,
}: {
  problem: ProblemView;
  /** What a kind of problem adds after its text: a lab's dataset, its checks, what to fix. */
  children?: React.ReactNode;
}) {
  const question = problem;
  const coding = problem.coding;
  const sql = problem.type === 'sql';
  const [shownHints, setShownHints] = useState(0);

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="eyebrow">{problem.eyebrow}</p>
        <h1 className="font-display text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-[1.75rem]">
          {problem.title}
        </h1>
        <p className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {problem.facts.map((fact, index) => (
            <span key={fact} className="contents">
              {index > 0 ? <span aria-hidden="true">·</span> : null}
              <span>{fact}</span>
            </span>
          ))}
        </p>
      </header>

      <RichText text={question.body} />

      {children}

      {coding && !sql && coding.inputFormat ? (
        <Section title="Input">
          <RichText text={coding.inputFormat} className="text-sm leading-6" />
        </Section>
      ) : null}
      {coding && !sql && coding.outputFormat ? (
        <Section title="Output">
          <RichText text={coding.outputFormat} className="text-sm leading-6" />
        </Section>
      ) : null}
      {coding?.constraints ? (
        <Section title="Constraints">
          <RichText text={coding.constraints} className="text-sm leading-6" />
        </Section>
      ) : null}

      {sql && coding?.schemaSql ? (
        <Section title="The tables">
          <Block text={coding.schemaSql} />
          <p className="text-xs text-muted-foreground">
            {coding.compareMode === 'rows'
              ? 'Your result is compared row by row, in order.'
              : 'Your result is compared as a set of rows; their order does not matter.'}{' '}
            Column names do not have to match.
          </p>
        </Section>
      ) : null}

      {coding && coding.samples.length > 0 ? (
        <Section title={coding.samples.length === 1 ? 'Example' : 'Examples'}>
          <ol className="space-y-3">
            {coding.samples.map((sample, index) => (
              <li key={sample.id} className="rounded-lg border border-border bg-card p-3">
                <p className="mb-2 text-xs font-semibold text-foreground-secondary">
                  {sample.label || `Example ${index + 1}`}
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      {sql ? 'Extra rows' : 'Input'}
                    </p>
                    <Block text={sample.input} />
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      Expected {sql ? 'result' : 'output'}
                    </p>
                    {sql ? (
                      <ResultTable json={sample.expectedOutput} />
                    ) : (
                      <Block text={sample.expectedOutput} />
                    )}
                  </div>
                </div>
                {sample.explanation ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <InlineText text={sample.explanation} />
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
          {coding.hiddenCount > 0 ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" aria-hidden="true" />
              {plural(coding.hiddenCount, 'more case')} {coding.hiddenCount === 1 ? 'is' : 'are'}{' '}
              hidden. A submission is checked against {coding.hiddenCount === 1 ? 'it' : 'them'} as
              well.
            </p>
          ) : null}
        </Section>
      ) : null}

      {coding ? (
        <p className="text-xs text-muted-foreground">
          Limits:{' '}
          {coding.timeLimitMs >= 1000
            ? `${coding.timeLimitMs / 1000} s`
            : `${coding.timeLimitMs} ms`}{' '}
          and {coding.memoryLimitMb} MB for each case.
        </p>
      ) : null}

      {question.spec && ['file_upload', 'practical', 'project'].includes(question.type) ? (
        <Section title="What to hand in">
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground-secondary">
            {question.spec.linkRequired ? (
              <li>A link: {question.spec.linkLabel || 'where your work can be seen'}</li>
            ) : null}
            {question.spec.maxFiles > 0 ? (
              <li>
                Up to {plural(question.spec.maxFiles, 'file')}
                {question.spec.fileKinds.length > 0
                  ? ` (${question.spec.fileKinds.join(', ')})`
                  : ''}
              </li>
            ) : null}
            {question.spec.checklist.length > 0 ? (
              <li>Confirm each point on the checklist below</li>
            ) : null}
          </ul>
        </Section>
      ) : null}

      {question.hints.length > 0 ? (
        <section className="space-y-2" aria-label="Hints">
          {question.hints.slice(0, shownHints).map((hint, index) => (
            <div
              key={index}
              className="rounded-lg border border-achievement/30 bg-achievement-soft/60 px-4 py-3 text-sm"
            >
              <p className="mb-1 text-xs font-semibold text-achievement">Hint {index + 1}</p>
              <RichText text={hint} className="text-sm leading-6" />
            </div>
          ))}
          {shownHints < question.hints.length ? (
            <Button variant="outline" size="sm" onClick={() => setShownHints((n) => n + 1)}>
              <Lightbulb aria-hidden="true" />
              {shownHints === 0 ? 'Show a hint' : 'Show another hint'}
            </Button>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
