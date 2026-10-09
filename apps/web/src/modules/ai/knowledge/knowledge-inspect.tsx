'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { KnowledgeChunkPage, KnowledgeDocumentView, KnowledgeVersionView } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { StatusBadge } from '@/components/status-badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { api } from '@/lib/api/http';
import { formatDateTime } from '@/lib/format';
import { KNOWLEDGE_KEYS, indexFailureMessage, readFailureMessage } from './knowledge-state';

const CHUNKS_PAGE_SIZE = 10;

/**
 * One document, inspected: every version with how it was read and indexed, and the passages of
 * the one answers draw on — what SI Academy AI is given, exactly as it was read.
 */
export function InspectDocumentSheet({
  document,
  onClose,
}: {
  document: KnowledgeDocumentView;
  onClose: () => void;
}) {
  const current = document.versions.find((version) => version.isCurrent) ?? null;
  const newest = document.versions.at(-1) ?? null;
  const [versionId, setVersionId] = useState<string | null>(current?.id ?? newest?.id ?? null);
  const shown = document.versions.find((version) => version.id === versionId) ?? null;
  return (
    <Sheet open onOpenChange={(open) => (open ? null : onClose())}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
      >
        <SheetHeader>
          <SheetTitle>{document.title}</SheetTitle>
          <SheetDescription>
            {document.lesson
              ? `About ${document.lesson.moduleTitle} › ${document.lesson.title}.`
              : 'About its whole source.'}{' '}
            Reference {document.canonicalRef}.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-6">
          <section aria-labelledby="knowledge-versions" className="space-y-2">
            <h3 id="knowledge-versions" className="text-sm font-semibold">
              Versions
            </h3>
            <ol className="divide-y divide-border rounded-lg border border-border">
              {[...document.versions].reverse().map((version) => (
                <li key={version.id}>
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none aria-[current=true]:bg-surface-2"
                    aria-current={version.id === versionId}
                    onClick={() => setVersionId(version.id)}
                  >
                    <span className="font-medium">Version {version.version}</span>
                    {version.isCurrent ? <StatusBadge status="current" tone="success" /> : null}
                    <VersionStates version={version} />
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDateTime(version.createdAt)} · {version.format ?? 'unknown'} ·{' '}
                      {version.characterCount.toLocaleString()} characters
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
          {shown ? <VersionChunks version={shown} /> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function VersionStates({ version }: { version: KnowledgeVersionView }) {
  return (
    <>
      {version.status === 'failed' ? (
        <StatusBadge status="failed" label="Could not read" tone="danger" />
      ) : version.status === 'chunked' ? (
        <StatusBadge status="read" label={`${version.chunkCount} passages`} tone="info" />
      ) : (
        <StatusBadge status="reading" label="Reading" tone="brand" />
      )}
      {version.embedding ? (
        <StatusBadge
          status={version.embedding.status}
          label={
            version.embedding.status === 'embedded'
              ? 'Indexed'
              : version.embedding.status === 'failed'
                ? 'Could not index'
                : `Indexing ${version.embedding.embedded} of ${version.embedding.total}`
          }
          tone={
            version.embedding.status === 'embedded'
              ? 'success'
              : version.embedding.status === 'failed'
                ? 'danger'
                : 'brand'
          }
        />
      ) : null}
    </>
  );
}

function VersionChunks({ version }: { version: KnowledgeVersionView }) {
  const [page, setPage] = useState(1);
  const chunks = useQuery({
    queryKey: KNOWLEDGE_KEYS.chunks(version.id, page),
    queryFn: () =>
      api<KnowledgeChunkPage>(
        `/ai/knowledge/versions/${version.id}/chunks?page=${page}&pageSize=${CHUNKS_PAGE_SIZE}`,
      ),
    enabled: version.status === 'chunked',
  });
  return (
    <section aria-labelledby="knowledge-passages" className="space-y-2">
      <h3 id="knowledge-passages" className="text-sm font-semibold">
        Passages of version {version.version}
      </h3>
      {version.status === 'failed' ? (
        <p className="text-sm text-danger">{readFailureMessage(version.failureCode)}</p>
      ) : null}
      {version.embedding?.status === 'failed' ? (
        <p className="text-sm text-danger">{indexFailureMessage(version.embedding.failureCode)}</p>
      ) : null}
      {version.status !== 'chunked' && version.status !== 'failed' ? (
        <p className="text-sm text-muted-foreground">Its passages appear once it has been read.</p>
      ) : null}
      {chunks.isPending && version.status === 'chunked' ? <LoadingRows rows={3} /> : null}
      {chunks.isError ? <ErrorState error={chunks.error} onRetry={() => chunks.refetch()} /> : null}
      {chunks.data ? (
        <>
          <ol className="space-y-2">
            {chunks.data.items.map((chunk) => (
              <li key={chunk.id} className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">
                  Passage {chunk.position + 1}
                  {chunk.heading ? ` · ${chunk.heading}` : ''} ·{' '}
                  {chunk.characterCount.toLocaleString()} characters
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{chunk.content}</p>
              </li>
            ))}
          </ol>
          <PaginationBar
            page={chunks.data.page}
            pageSize={chunks.data.pageSize}
            total={chunks.data.total}
            onPageChange={setPage}
            noun="passages"
          />
        </>
      ) : null}
    </section>
  );
}
