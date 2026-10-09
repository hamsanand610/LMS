'use client';

import { useMutation } from '@tanstack/react-query';
import { useId, useState } from 'react';
import {
  KNOWLEDGE_RETRIEVAL_QUERY_MAX,
  KNOWLEDGE_RETRIEVAL_QUERY_MIN,
  type KnowledgeAnswer,
  type KnowledgeSourceDetail,
} from '@lms/shared';
import { FieldError } from '@/components/field-error';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api/http';
import { aiErrorMessage } from '../ai-errors';

const OUTCOME: Record<KnowledgeAnswer['status'], { label: string; tone: StatusTone }> = {
  answered: { label: 'Answered from the documents', tone: 'success' },
  insufficient_evidence: { label: 'Not enough evidence', tone: 'warning' },
  conflicting: { label: 'The sources disagree', tone: 'warning' },
  not_grounded: { label: 'Withheld: not supported', tone: 'danger' },
};

/**
 * A question tried before learners ask it (Roadmap Phase 10): answered as SI Academy AI answers —
 * grounded in the published documents, every sentence citing its passage, or declined — over this
 * source or the institute's whole published knowledge. Counted against the manager's own daily
 * allowance, like any question.
 */
export function TryKnowledgeQuestion({ source }: { source: KnowledgeSourceDetail }) {
  const questionId = useId();
  const scopeId = useId();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'source' | 'all'>(
    source.status === 'published' ? 'source' : 'all',
  );
  const [error, setError] = useState<string>();
  const ask = useMutation({
    mutationFn: () =>
      api<KnowledgeAnswer>('/ai/knowledge/preview', {
        method: 'POST',
        body: { query: query.trim(), ...(scope === 'source' ? { sourceId: source.id } : {}) },
      }),
    onError: (failure) => setError(aiErrorMessage(failure)),
  });
  const answer = ask.data;
  return (
    <div className="max-w-3xl space-y-4">
      {source.status !== 'published' ? (
        <p className="text-sm text-muted-foreground">
          This source is a {source.status}: nothing in it is drawn on. Questions here use the
          institute’s other published knowledge.
        </p>
      ) : null}
      <form
        className="space-y-3"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setError(undefined);
          const length = query.trim().length;
          if (length < KNOWLEDGE_RETRIEVAL_QUERY_MIN) {
            setError('Write a question first.');
            return;
          }
          ask.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor={questionId}>Question</Label>
          <Textarea
            id={questionId}
            rows={3}
            maxLength={KNOWLEDGE_RETRIEVAL_QUERY_MAX}
            value={query}
            placeholder="Ask what a learner would ask"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor={scopeId}>Draw on</Label>
            <NativeSelect
              id={scopeId}
              value={scope}
              onChange={(event) => setScope(event.target.value as 'source' | 'all')}
            >
              <option value="source" disabled={source.status !== 'published'}>
                This source only
              </option>
              <option value="all">All published knowledge</option>
            </NativeSelect>
          </div>
          <Button type="submit" disabled={ask.isPending}>
            {ask.isPending ? 'Asking…' : 'Ask'}
          </Button>
        </div>
        <FieldError message={error} />
      </form>

      {answer ? (
        <section
          aria-live="polite"
          className="space-y-3 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={answer.status}
              label={OUTCOME[answer.status].label}
              tone={OUTCOME[answer.status].tone}
            />
            <span className="text-xs text-muted-foreground">
              {answer.evidence.retrieved} passages found, {answer.evidence.used} close enough to use
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{answer.answer}</p>
          {answer.citations.length > 0 ? (
            <ol className="space-y-1.5 text-sm">
              {answer.citations.map((citation) => (
                <li key={citation.id} className="flex flex-wrap gap-x-2">
                  <span className="font-mono text-xs font-semibold">[{citation.id}]</span>
                  <span className="font-medium">{citation.title}</span>
                  {citation.heading ? (
                    <span className="text-muted-foreground">› {citation.heading}</span>
                  ) : null}
                  <span className="text-muted-foreground">
                    · {citation.sourceName} · {Math.round(citation.similarity * 100)}% match
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
