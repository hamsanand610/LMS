import {
  AI_KNOWLEDGE_FLAG,
  AI_MODULE_FLAG,
  KNOWLEDGE_UPLOAD_MAX_BYTES,
  type KnowledgeAudience,
  type KnowledgeDocumentView,
  type KnowledgeSourceStatus,
  type KnowledgeVersionView,
  type MeResponse,
  knowledgeFormatOfFileName,
  knowledgeVersionUploadSchema,
} from '@lms/shared';
import type { StatusTone } from '@/components/status-badge';

/** The Knowledge base page's queries. */
export const KNOWLEDGE_KEYS = {
  all: ['ai', 'knowledge'] as const,
  status: ['ai', 'knowledge', 'status'] as const,
  sources: ['ai', 'knowledge', 'sources'] as const,
  source: (id: string) => ['ai', 'knowledge', 'source', id] as const,
  chunks: (versionId: string, page: number) =>
    ['ai', 'knowledge', 'chunks', versionId, page] as const,
};

/**
 * The Knowledge base page (Roadmap Phase 10): `module.ai`, `ai.knowledge` and
 * `ai:knowledge_manage` — the Super Admin's. The API refuses the same requests whatever the page
 * shows.
 */
export function canManageKnowledge(me: Pick<MeResponse, 'flags' | 'permissions'>): boolean {
  return (
    me.flags[AI_MODULE_FLAG] === true &&
    me.flags[AI_KNOWLEDGE_FLAG] === true &&
    me.permissions.some((granted) => granted.key === 'ai:knowledge_manage')
  );
}

export const AUDIENCE_LABEL: Record<KnowledgeAudience, string> = {
  institute: 'Everyone in the institute',
  staff: 'Staff only',
  course: 'One course',
};

/** Why a version could not be read, in words a manager can act on (by `KNOWLEDGE_INGESTION_FAILURES`). */
const READ_FAILURES: Record<string, string> = {
  unsupported_format: 'This type of file cannot be read. Upload Markdown, text or HTML.',
  missing_file: 'The stored file is missing. Upload the document again.',
  file_mismatch: 'The stored file does not belong to this version. Upload it again.',
  checksum_mismatch: 'The stored file changed after it was uploaded. Upload it again.',
  source_too_large: 'The file is too large to read.',
  malformed_content: 'The file is not UTF-8 text. Save it as UTF-8 and upload it again.',
  parser_failed: 'The file could not be read. Check that it is valid Markdown, text or HTML.',
  empty_content: 'The file has no readable text.',
  content_too_large:
    'The file holds more than 200,000 characters of text. Split it into smaller documents.',
  chunking_failed: 'The text could not be divided into passages.',
  too_many_chunks: 'The file is too long. Split it into smaller documents.',
  storage_unavailable: 'Storage was unavailable for a moment. Process it again.',
  persist_failed: 'The passages could not be saved. Process it again.',
  source_archived: 'The source is archived.',
  document_archived: 'The document is archived.',
  document_mismatch: 'The lesson it names is not in this source’s course.',
  stale_version: 'A newer version of the document is current.',
  processing_timeout: 'Reading took too long. Process it again.',
};

/** Why a version could not be indexed, in words a manager can act on (by `KNOWLEDGE_EMBEDDING_FAILURES`). */
const INDEX_FAILURES: Record<string, string> = {
  provider_unavailable: 'The AI provider was unavailable. Process it again later.',
  provider_rate_limited: 'The AI provider was busy. Process it again in a few minutes.',
  provider_timeout: 'The AI provider took too long. Process it again.',
  provider_auth: 'The AI provider refused the platform’s key. Ask the platform team to check it.',
  provider_configuration:
    'The AI provider is not configured for indexing. Ask the platform team to check it.',
  provider_bad_request: 'The AI provider could not index this text. Process it again.',
  provider_malformed: 'The AI provider returned an unusable result. Process it again.',
  wrong_dimension: 'The AI provider returned an unusable result. Process it again.',
  invalid_vector: 'The AI provider returned an unusable result. Process it again.',
  budget_exceeded: 'The institute’s AI budget for the month is used up.',
  unpriced_model: 'The indexing model has no price under the institute’s budget.',
  embeddings_unavailable: 'Indexing is not available on this installation.',
  not_published: 'Publish the source to index it.',
  not_current: 'A newer version of the document is current.',
  not_chunked: 'This version has not been read yet.',
  source_archived: 'The source is archived.',
  document_archived: 'The document is archived.',
  data_class_held_back: 'Personal knowledge is not indexed.',
  data_class_not_approved: 'SI Academy AI is not approved for this kind of material.',
  persist_failed: 'Indexing stopped part-way. Process it again.',
  processing_timeout: 'Indexing took too long. Process it again.',
  incomplete: 'Indexing stopped part-way. Process it again.',
};

export function readFailureMessage(code: string | null): string {
  return (code && READ_FAILURES[code]) || 'The document could not be read. Process it again.';
}

export function indexFailureMessage(code: string | null): string {
  return (code && INDEX_FAILURES[code]) || 'The document could not be indexed. Process it again.';
}

export interface DocumentState {
  key:
    | 'empty'
    | 'reading'
    | 'read_failed'
    | 'unindexed_draft'
    | 'withdrawn'
    | 'not_indexed'
    | 'indexing'
    | 'index_failed'
    | 'ready';
  label: string;
  tone: StatusTone;
  /** What to know or do next, when there is something. */
  detail?: string;
  /** Work is under way: the page asks again until it ends. */
  busy: boolean;
}

/**
 * Where a document stands, from its newest version and its source: being read, failed, read but
 * waiting for its source to be published, being indexed, failed to index, or ready — answers draw
 * on it. While a newer version is read, the previous one keeps answering until the new one is read.
 */
export function documentState(
  document: Pick<KnowledgeDocumentView, 'versions'>,
  sourceStatus: KnowledgeSourceStatus,
): DocumentState {
  const newest = document.versions.at(-1);
  if (!newest) {
    return { key: 'empty', label: 'No file yet', tone: 'neutral', busy: false };
  }
  if (sourceStatus === 'archived') {
    return {
      key: 'withdrawn',
      label: 'Withdrawn',
      tone: 'neutral',
      detail: 'The source is archived: nothing in it is drawn on.',
      busy: false,
    };
  }
  const previous = document.versions.find((version) => version.isCurrent && version !== newest);
  const stillAnswering =
    previous?.embedding?.status === 'embedded' ? ' The previous version still answers.' : '';
  if (newest.status === 'pending' || newest.status === 'processing') {
    return { key: 'reading', label: 'Reading', tone: 'brand', busy: true };
  }
  if (newest.status === 'failed') {
    return {
      key: 'read_failed',
      label: 'Could not read',
      tone: 'danger',
      detail: `${readFailureMessage(newest.failureCode)}${stillAnswering}`,
      busy: false,
    };
  }
  if (sourceStatus === 'draft') {
    return {
      key: 'unindexed_draft',
      label: 'Read',
      tone: 'info',
      detail: 'Publish the source to index it for answers.',
      busy: false,
    };
  }
  return indexState(newest);
}

function indexState(version: KnowledgeVersionView): DocumentState {
  const run = version.embedding;
  if (!run) {
    return {
      key: 'not_indexed',
      label: 'Not indexed',
      tone: 'warning',
      detail: 'Process it again to index it.',
      busy: false,
    };
  }
  if (run.status === 'pending' || run.status === 'embedding') {
    return {
      key: 'indexing',
      label: run.total > 0 ? `Indexing ${run.embedded} of ${run.total}` : 'Indexing',
      tone: 'brand',
      busy: true,
    };
  }
  if (run.status === 'failed') {
    return {
      key: 'index_failed',
      label: 'Could not index',
      tone: 'danger',
      detail: indexFailureMessage(run.failureCode),
      busy: false,
    };
  }
  return { key: 'ready', label: 'Ready', tone: 'success', busy: false };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A title from a file's name: its extension gone, its separators spaces, its first letter upper. */
export function titleFromFileName(name: string): string {
  const bare = name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return bare ? bare[0]!.toUpperCase() + bare.slice(1) : '';
}

export type ReadFile =
  { ok: true; fileName: string; content: string } | { ok: false; error: string };

/**
 * A chosen file, checked as the API will check it before anything is sent: a type the pipeline
 * reads, within the size, and UTF-8 text.
 */
export async function readKnowledgeFile(file: File): Promise<ReadFile> {
  if (!knowledgeFormatOfFileName(file.name)) {
    return {
      ok: false,
      error: 'Choose a Markdown, text or HTML file (.md, .markdown, .txt, .html or .htm).',
    };
  }
  if (file.size === 0) return { ok: false, error: 'The file is empty.' };
  if (file.size > KNOWLEDGE_UPLOAD_MAX_BYTES) {
    return {
      ok: false,
      error: `The file is ${formatBytes(file.size)}. The largest file the knowledge base takes is ${formatBytes(KNOWLEDGE_UPLOAD_MAX_BYTES)}.`,
    };
  }
  const content = await file.text();
  const checked = knowledgeVersionUploadSchema.safeParse({ fileName: file.name, content });
  if (!checked.success) {
    return { ok: false, error: checked.error.issues[0]?.message ?? 'The file cannot be used.' };
  }
  return { ok: true, fileName: file.name, content };
}
