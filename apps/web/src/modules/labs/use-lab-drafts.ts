'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExecutionLanguage, LabDraftRecord } from '@lms/shared';
import { api } from '@/lib/api/http';

/** Quiet time before an edit is saved; the API allows 120 saves in five minutes. */
const SAVE_AFTER_MS = 3000;

export type DraftState = 'idle' | 'saving' | 'saved' | 'failed';

export interface LabDrafts {
  /** Loaded once the drafts have been read. */
  ready: boolean;
  /** The saved code for each language, as it was when the lab opened. */
  initial: Record<string, string>;
  state: DraftState;
  /** Called on every edit; saved once the learner pauses. */
  change: (language: ExecutionLanguage, code: string) => void;
  /** "Reset": the draft goes, so the lab opens on its starting code again. */
  clear: (language: ExecutionLanguage) => void;
}

/**
 * A learner's unfinished work in a lab or the playground, kept on the server so it follows them to
 * another device (ADR-0018). Edits are saved after a pause, again when the page is hidden, and the
 * same text is never sent twice.
 */
export function useLabDrafts(scope: string, enabled = true): LabDrafts {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['labs', 'drafts', scope],
    queryFn: () => api<LabDraftRecord[]>(`/practice/drafts?scope=${encodeURIComponent(scope)}`),
    enabled,
    staleTime: Infinity,
  });
  const [state, setState] = useState<DraftState>('idle');
  const pending = useRef(new Map<string, string>());
  const saved = useRef(new Map<string, string>());
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const entries = [...pending.current.entries()];
    pending.current.clear();
    for (const [language, code] of entries) {
      if (saved.current.get(language) === code) continue;
      setState('saving');
      try {
        await api<LabDraftRecord>('/practice/drafts', {
          method: 'PUT',
          body: { scope, language, code },
        });
        saved.current.set(language, code);
        setState('saved');
      } catch {
        // Kept for the next pause, so nothing typed is lost to a passing failure.
        if (!pending.current.has(language)) pending.current.set(language, code);
        setState('failed');
      }
    }
  }, [scope]);

  const change = useCallback(
    (language: ExecutionLanguage, code: string) => {
      if (!enabled) return;
      pending.current.set(language, code);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), SAVE_AFTER_MS);
    },
    [enabled, flush],
  );

  const clear = useCallback(
    (language: ExecutionLanguage) => {
      if (!enabled) return;
      pending.current.delete(language);
      saved.current.delete(language);
      void api(
        `/practice/drafts?scope=${encodeURIComponent(scope)}&language=${encodeURIComponent(language)}`,
        { method: 'DELETE' },
      )
        .then(() => queryClient.invalidateQueries({ queryKey: ['labs', 'in-progress'] }))
        .catch(() => setState('failed'));
    },
    [enabled, scope, queryClient],
  );

  // Leaving the page or hiding it saves what is waiting.
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      void flush();
    };
  }, [flush]);

  // What the server already holds is not sent again.
  useEffect(() => {
    for (const draft of query.data ?? []) {
      if (!saved.current.has(draft.language)) saved.current.set(draft.language, draft.code);
    }
  }, [query.data]);

  const initial = useMemo(
    () => Object.fromEntries((query.data ?? []).map((draft) => [draft.language, draft.code])),
    [query.data],
  );
  return { ready: !enabled || query.isSuccess || query.isError, initial, state, change, clear };
}

/** What the draft state says in the toolbar. */
export function draftLabel(state: DraftState): string | null {
  if (state === 'saving') return 'Saving draft…';
  if (state === 'saved') return 'Draft saved';
  if (state === 'failed') return 'Draft not saved yet';
  return null;
}
