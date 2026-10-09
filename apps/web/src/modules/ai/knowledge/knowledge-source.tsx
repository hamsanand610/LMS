'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import type {
  KnowledgeDocumentView,
  KnowledgeProcessingSummary,
  KnowledgeSourceDetail,
  KnowledgeSourceView,
} from '@lms/shared';
import { FieldError } from '@/components/field-error';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { StatStrip } from '@/components/stat-strip';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api/http';
import { formatDate, formatDateTime } from '@/lib/format';
import { useParentPath } from '@/lib/use-parent-path';
import { PageHeader } from '@/shell/page-header';
import {
  ConfirmDialog,
  EditDocumentDialog,
  NewVersionDialog,
  UploadDocumentDialog,
  knowledgeErrorMessage,
} from './knowledge-dialogs';
import { InspectDocumentSheet } from './knowledge-inspect';
import { AUDIENCE_LABEL, KNOWLEDGE_KEYS, documentState } from './knowledge-state';
import { TryKnowledgeQuestion } from './knowledge-try';

/** How often the page asks again while a document is being read or indexed. */
const POLL_MS = 3_000;

type Confirming = 'publish' | 'archive' | 'delete' | null;

/**
 * One knowledge source (Roadmap Phase 10): its documents and where each stands — read, indexed,
 * failed and why — with their uploads, new versions, edits, processing again, inspection and
 * deletion; a question tried over it; and its details. While anything is being read or indexed the
 * page asks again on its own.
 */
export function KnowledgeSourceWorkspace({ sourceId }: { sourceId: string }) {
  const listHref = useParentPath();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const query = useQuery({
    queryKey: KNOWLEDGE_KEYS.source(sourceId),
    queryFn: () => api<KnowledgeSourceDetail>(`/ai/knowledge/sources/${sourceId}`),
    refetchInterval: (state) => {
      const source = state.state.data;
      return source?.documents.some((document) => documentState(document, source.status).busy)
        ? POLL_MS
        : false;
    },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEYS.all });

  const publish = useMutation({
    mutationFn: async () => {
      await api<KnowledgeSourceView>(`/ai/knowledge/sources/${sourceId}/publish`, {
        method: 'POST',
      });
      return api<KnowledgeProcessingSummary>(`/ai/knowledge/sources/${sourceId}/process`, {
        method: 'POST',
      });
    },
    onSuccess: async (summary) => {
      await refresh();
      setConfirming(null);
      toast.success(
        summary.indexing + summary.ingesting > 0
          ? 'Published: its documents are being indexed'
          : 'Published',
      );
    },
    onError: (error) => toast.error(knowledgeErrorMessage(error, 'The source was not published')),
  });
  const archive = useMutation({
    mutationFn: () =>
      api<KnowledgeSourceView>(`/ai/knowledge/sources/${sourceId}/archive`, { method: 'POST' }),
    onSuccess: async () => {
      await refresh();
      setConfirming(null);
      toast.success('Archived: nothing in it is drawn on again');
    },
    onError: (error) => toast.error(knowledgeErrorMessage(error, 'The source was not archived')),
  });
  const remove = useMutation({
    mutationFn: () => api<void>(`/ai/knowledge/sources/${sourceId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setConfirming(null);
      // Away first: the source's own query is not asked again for a source that is gone.
      router.push(listHref);
      toast.success('Source deleted with all its documents');
      await queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEYS.sources });
      await queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEYS.status });
    },
    onError: (error) => toast.error(knowledgeErrorMessage(error, 'The source was not deleted')),
  });
  const processAll = useMutation({
    mutationFn: () =>
      api<KnowledgeProcessingSummary>(`/ai/knowledge/sources/${sourceId}/process`, {
        method: 'POST',
      }),
    onSuccess: async (summary) => {
      await refresh();
      toast.success(
        `${summary.ingesting + summary.indexing} sent to be processed, ${summary.ready} ready, ${summary.waiting} waiting`,
      );
    },
    onError: (error) => toast.error(knowledgeErrorMessage(error, 'Nothing was processed')),
  });

  if (query.isPending) return <LoadingRows rows={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const source = query.data;
  const states = source.documents.map((document) => documentState(document, source.status));
  const count = (key: string) => states.filter((state) => state.key === key).length;
  const failed = count('read_failed') + count('index_failed');
  const working = states.filter((state) => state.busy).length;
  const passages = source.documents.reduce(
    (sum, document) =>
      sum + (document.versions.find((version) => version.isCurrent)?.chunkCount ?? 0),
    0,
  );
  const open = source.status !== 'archived';

  return (
    <>
      <PageHeader
        back={{ href: listHref, label: 'Knowledge base' }}
        eyebrow="Knowledge source"
        title={source.name}
        description={source.description || undefined}
        meta={
          <StatusBadge
            status={source.status}
            tone={source.status === 'published' ? 'success' : undefined}
          />
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {open ? <Button onClick={() => setUploading(true)}>Upload document</Button> : null}
            {source.status === 'draft' ? (
              <Button variant="outline" onClick={() => setConfirming('publish')}>
                Publish
              </Button>
            ) : null}
            {source.status === 'published' ? (
              <Button
                variant="outline"
                disabled={processAll.isPending}
                onClick={() => processAll.mutate()}
              >
                {processAll.isPending ? 'Processing…' : 'Process waiting documents'}
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" aria-label={`More actions for ${source.name}`}>
                  More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {open ? (
                  <DropdownMenuItem onSelect={() => setConfirming('archive')}>
                    Archive
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem className="text-danger" onSelect={() => setConfirming('delete')}>
                  Delete source
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />
      <StatStrip
        className="mb-6"
        items={[
          {
            label: 'For',
            value:
              source.audience === 'course'
                ? (source.course?.title ?? 'A course')
                : AUDIENCE_LABEL[source.audience],
          },
          { label: 'Documents', value: String(source.documents.length) },
          { label: 'Ready', value: String(count('ready')), tone: 'success' },
          { label: 'Working', value: String(working), tone: working > 0 ? 'warning' : 'default' },
          { label: 'Failed', value: String(failed), tone: failed > 0 ? 'danger' : 'default' },
          { label: 'Passages', value: String(passages) },
        ]}
      />

      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="try">Try a question</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="documents" className="pt-4">
          <DocumentsTable source={source} onUpload={() => setUploading(true)} />
        </TabsContent>
        <TabsContent value="try" className="pt-4">
          <TryKnowledgeQuestion source={source} />
        </TabsContent>
        <TabsContent value="details" className="pt-4">
          <SourceDetails source={source} />
        </TabsContent>
      </Tabs>

      {open ? (
        <UploadDocumentDialog source={source} open={uploading} onOpenChange={setUploading} />
      ) : null}
      {confirming === 'publish' ? (
        <ConfirmDialog
          title={`Publish ${source.name}?`}
          description={`${
            source.audience === 'course'
              ? `The learners and trainers of ${source.course?.title ?? 'its course'}`
              : source.audience === 'staff'
                ? 'Trainers and administrators'
                : 'Everyone in the institute'
          } can then get answers from its documents. Each document is indexed by the AI provider. Who it is for cannot change afterwards.`}
          confirm="Publish"
          pending={publish.isPending}
          onConfirm={() => publish.mutate()}
          onClose={() => setConfirming(null)}
        />
      ) : null}
      {confirming === 'archive' ? (
        <ConfirmDialog
          title={`Archive ${source.name}?`}
          description="Nothing in it is drawn on again, and its index is removed. Its documents stay listed here. An archived source cannot be published again."
          confirm="Archive"
          destructive
          pending={archive.isPending}
          onConfirm={() => archive.mutate()}
          onClose={() => setConfirming(null)}
        />
      ) : null}
      {confirming === 'delete' ? (
        <ConfirmDialog
          title={`Delete ${source.name}?`}
          description={`Its ${source.documents.length} document(s), their versions, passages, index and stored files are removed for good. The audit log keeps a record that it existed.`}
          confirm="Delete for good"
          destructive
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirming(null)}
        />
      ) : null}
    </>
  );
}

type DocumentAction = 'inspect' | 'version' | 'edit' | 'delete';

function DocumentsTable({
  source,
  onUpload,
}: {
  source: KnowledgeSourceDetail;
  onUpload: () => void;
}) {
  const queryClient = useQueryClient();
  const [acting, setActing] = useState<{
    document: KnowledgeDocumentView;
    action: DocumentAction;
  } | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEYS.all });
  const processAgain = useMutation({
    mutationFn: (document: KnowledgeDocumentView) =>
      api<KnowledgeDocumentView>(`/ai/knowledge/documents/${document.id}/process`, {
        method: 'POST',
      }),
    onSuccess: async (document) => {
      await refresh();
      toast.success(`${document.title} is being processed again`);
    },
    onError: (error) => toast.error(knowledgeErrorMessage(error, 'It was not processed again')),
  });
  const remove = useMutation({
    mutationFn: (document: KnowledgeDocumentView) =>
      api<void>(`/ai/knowledge/documents/${document.id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await refresh();
      setActing(null);
      toast.success('Document deleted: nothing of it is drawn on again');
    },
    onError: (error) => toast.error(knowledgeErrorMessage(error, 'The document was not deleted')),
  });
  const open = source.status !== 'archived';

  if (source.documents.length === 0) {
    return (
      <EmptyState
        title="No documents yet"
        description="Upload Markdown, text or HTML files. Each is read into passages; once the source is published, they are indexed and SI Academy AI can answer from them."
        action={open ? <Button onClick={onUpload}>Upload document</Button> : undefined}
      />
    );
  }
  // The live document, for an action opened before a refresh.
  const live = acting
    ? (source.documents.find((document) => document.id === acting.document.id) ?? acting.document)
    : null;

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              {source.audience === 'course' ? <TableHead>About</TableHead> : null}
              <TableHead>Version</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="text-right">Passages</TableHead>
              <TableHead>Added</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {source.documents.map((document) => {
              const state = documentState(document, source.status);
              const current = document.versions.find((version) => version.isCurrent);
              const newest = document.versions.at(-1);
              return (
                <TableRow key={document.id}>
                  <TableCell className="max-w-72">
                    <button
                      type="button"
                      className="text-left font-medium hover:underline"
                      onClick={() => setActing({ document, action: 'inspect' })}
                    >
                      {document.title}
                    </button>
                    <p className="truncate text-xs text-muted-foreground">
                      {document.canonicalRef}
                    </p>
                  </TableCell>
                  {source.audience === 'course' ? (
                    <TableCell className="text-sm">
                      {document.lesson ? (
                        <>
                          <span className="block">{document.lesson.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {document.lesson.moduleTitle}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Whole course</span>
                      )}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-sm tabular-nums">
                    {newest ? `v${newest.version}` : '—'}
                    {current && newest && current.id !== newest.id ? (
                      <span className="block text-xs text-muted-foreground">
                        v{current.version} answers
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-80">
                    <StatusBadge status={state.key} label={state.label} tone={state.tone} />
                    {state.detail ? (
                      <p className="mt-1 text-xs text-muted-foreground">{state.detail}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {current?.chunkCount ?? 0}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(document.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Actions for ${document.title}`}
                        >
                          Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => setActing({ document, action: 'inspect' })}
                        >
                          Inspect
                        </DropdownMenuItem>
                        {open ? (
                          <>
                            <DropdownMenuItem
                              onSelect={() => setActing({ document, action: 'version' })}
                            >
                              Upload new version
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={state.busy || !newest || processAgain.isPending}
                              onSelect={() => processAgain.mutate(document)}
                            >
                              Process again
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => setActing({ document, action: 'edit' })}
                            >
                              Edit
                            </DropdownMenuItem>
                          </>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-danger"
                          onSelect={() => setActing({ document, action: 'delete' })}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {live && acting?.action === 'inspect' ? (
        <InspectDocumentSheet document={live} onClose={() => setActing(null)} />
      ) : null}
      {live && acting?.action === 'version' ? (
        <NewVersionDialog document={live} onClose={() => setActing(null)} />
      ) : null}
      {live && acting?.action === 'edit' ? (
        <EditDocumentDialog source={source} document={live} onClose={() => setActing(null)} />
      ) : null}
      {live && acting?.action === 'delete' ? (
        <ConfirmDialog
          title={`Delete ${live.title}?`}
          description={`Its ${live.versions.length} version(s), their passages, index and stored files are removed for good, and SI Academy AI stops drawing on it at once. The audit log keeps a record.`}
          confirm="Delete for good"
          destructive
          pending={remove.isPending}
          onConfirm={() => remove.mutate(live)}
          onClose={() => setActing(null)}
        />
      ) : null}
    </>
  );
}

/** A source's name and description at any time; who it is for and what it holds while a draft. */
function SourceDetails({ source }: { source: KnowledgeSourceDetail }) {
  const queryClient = useQueryClient();
  const nameId = useId();
  const descriptionId = useId();
  const [name, setName] = useState(source.name);
  const [description, setDescription] = useState(source.description);
  const [error, setError] = useState<string>();
  const save = useMutation({
    mutationFn: () =>
      api<KnowledgeSourceView>(`/ai/knowledge/sources/${source.id}`, {
        method: 'PATCH',
        body: { name: name.trim(), description: description.trim() },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEYS.all });
      toast.success('Source saved');
    },
    onError: (failure) => setError(knowledgeErrorMessage(failure, 'The source was not saved')),
  });
  return (
    <div className="grid max-w-3xl gap-6 lg:grid-cols-[1fr_16rem]">
      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setError(undefined);
          if (name.trim().length < 2) {
            setError('Give it a name of at least 2 characters.');
            return;
          }
          save.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor={nameId}>Name</Label>
          <Input
            id={nameId}
            value={name}
            maxLength={160}
            disabled={source.status === 'archived'}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={descriptionId}>Description</Label>
          <Textarea
            id={descriptionId}
            rows={3}
            maxLength={2000}
            value={description}
            disabled={source.status === 'archived'}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <FieldError message={error} />
        {source.status !== 'archived' ? (
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        ) : null}
      </form>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground">For</dt>
          <dd>
            {source.audience === 'course'
              ? `The learners and trainers of ${source.course?.title ?? 'its course'}`
              : AUDIENCE_LABEL[source.audience]}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Holds</dt>
          <dd>{source.dataClass === 'course' ? 'Course material' : 'Public material'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Created</dt>
          <dd>{formatDateTime(source.createdAt)}</dd>
        </div>
        {source.publishedAt ? (
          <div>
            <dt className="text-muted-foreground">Published</dt>
            <dd>{formatDateTime(source.publishedAt)}</dd>
          </div>
        ) : null}
        {source.archivedAt ? (
          <div>
            <dt className="text-muted-foreground">Archived</dt>
            <dd>{formatDateTime(source.archivedAt)}</dd>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Who a source is for, and what it holds, are settled before it is published.
        </p>
      </dl>
    </div>
  );
}
