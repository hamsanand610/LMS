'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

export type { CodeEditorApi, CodeEditorProps, EditorLanguage } from './code-editor';

/**
 * The editor, loaded only on the pages that show one: CodeMirror and each language's grammar are
 * split out of every other page's bundle (ADR-0016).
 */
export const CodeEditor = dynamic(() => import('./code-editor').then((m) => m.CodeEditor), {
  ssr: false,
  loading: () => (
    <div data-nav-plane className="flex h-full min-h-[240px] flex-col gap-2 bg-[var(--nav-bg)] p-4">
      <span className="sr-only">Loading the editor…</span>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3.5 bg-[var(--nav-hover)]"
          style={{ width: `${40 + ((i * 17) % 50)}%` }}
        />
      ))}
    </div>
  ),
});
