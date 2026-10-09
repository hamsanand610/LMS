// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  KNOWLEDGE_UPLOAD_MAX_BYTES,
  type KnowledgeDocumentView,
  type KnowledgeSourceDetail,
  type KnowledgeVersionView,
} from '@lms/shared';
import { meWith, renderWith } from '../testing';
import { KnowledgeSourceWorkspace } from './knowledge-source';
import { KnowledgeSources } from './knowledge-sources';
import {
  canManageKnowledge,
  documentState,
  readKnowledgeFile,
  titleFromFileName,
} from './knowledge-state';

const mocks = vi.hoisted(() => ({ api: vi.fn(), push: vi.fn() }));
vi.mock('@/lib/api/http', () => ({ api: mocks.api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, replace: vi.fn() }),
  usePathname: () => '/admin/knowledge/0190a0e4-7c1d-7b9e-8f00-0000000000a1',
}));

const SOURCE = '0190a0e4-7c1d-7b9e-8f00-0000000000a1';
const COURSE = '0190a0e4-7c1d-7b9e-8f00-0000000000b1';
const MANAGER = meWith(
  { 'module.ai': true, 'ai.knowledge': true, 'ai.knowledge_answers': true },
  ['ai:knowledge_manage'],
  false,
);

function version(overrides: Partial<KnowledgeVersionView> = {}): KnowledgeVersionView {
  return {
    id: '0190a0e4-7c1d-7b9e-8f00-0000000000d1',
    version: 1,
    format: 'markdown',
    contentHash: 'a'.repeat(64),
    characterCount: 1200,
    status: 'chunked',
    isCurrent: true,
    chunkCount: 3,
    failureCode: null,
    parserVersion: 'markdown-1',
    chunkerVersion: 'sections-1/1200-2000-200-200',
    createdAt: '2026-10-09T08:00:00.000Z',
    chunkedAt: '2026-10-09T08:00:01.000Z',
    embedding: {
      status: 'embedded',
      provider: 'gemini',
      model: 'gemini-embedding-001',
      dimension: 768,
      embeddingVersion: 'embed-1',
      embedded: 3,
      total: 3,
      failureCode: null,
      embeddedAt: '2026-10-09T08:00:03.000Z',
    },
    ...overrides,
  };
}

function document(
  id: string,
  title: string,
  versions: KnowledgeVersionView[],
  lesson: KnowledgeDocumentView['lesson'] = null,
): KnowledgeDocumentView {
  return {
    id,
    sourceId: SOURCE,
    title,
    canonicalRef: `upload:${title.toLowerCase().replace(/ /g, '-')}.md:abcd1234`,
    lessonId: lesson?.id ?? null,
    lesson,
    status: 'active',
    versions,
    createdAt: '2026-10-09T08:00:00.000Z',
  };
}

function source(overrides: Partial<KnowledgeSourceDetail> = {}): KnowledgeSourceDetail {
  return {
    id: SOURCE,
    name: 'Core Java notes',
    description: 'What the trainers wrote for Core Java.',
    type: 'uploaded',
    audience: 'course',
    courseId: COURSE,
    course: { id: COURSE, title: 'Core Java' },
    dataClass: 'course',
    status: 'published',
    publishedAt: '2026-10-09T08:00:00.000Z',
    archivedAt: null,
    createdAt: '2026-10-09T07:00:00.000Z',
    documentCount: 2,
    documents: [],
    ...overrides,
  };
}

beforeEach(() => {
  mocks.api.mockReset();
  mocks.push.mockReset();
});
afterEach(cleanup);

describe('who sees the Knowledge base page', () => {
  it('is for whoever holds ai:knowledge_manage while module.ai and ai.knowledge are on', () => {
    expect(canManageKnowledge(MANAGER)).toBe(true);
    expect(
      canManageKnowledge(
        meWith({ 'module.ai': true, 'ai.knowledge': false }, ['ai:knowledge_manage'], false),
      ),
    ).toBe(false);
    expect(
      canManageKnowledge(
        meWith({ 'module.ai': false, 'ai.knowledge': true }, ['ai:knowledge_manage'], false),
      ),
    ).toBe(false);
    expect(
      canManageKnowledge(
        meWith({ 'module.ai': true, 'ai.knowledge': true }, ['ai:chat', 'ai:usage_read'], false),
      ),
    ).toBe(false);
  });
});

describe('where a document stands', () => {
  const doc = (versions: KnowledgeVersionView[]) => ({ versions });

  it('says what is happening and what to do, from its newest version and its source', () => {
    expect(documentState(doc([]), 'published')).toMatchObject({ key: 'empty', busy: false });
    expect(
      documentState(
        doc([version({ status: 'pending', isCurrent: false, embedding: null })]),
        'published',
      ),
    ).toMatchObject({
      key: 'reading',
      busy: true,
    });
    expect(documentState(doc([version()]), 'published')).toMatchObject({
      key: 'ready',
      tone: 'success',
    });
    expect(documentState(doc([version({ embedding: null })]), 'draft')).toMatchObject({
      key: 'unindexed_draft',
      detail: 'Publish the source to index it for answers.',
    });
    expect(documentState(doc([version({ embedding: null })]), 'published')).toMatchObject({
      key: 'not_indexed',
      busy: false,
    });
    expect(
      documentState(
        doc([
          version({ embedding: { ...version().embedding!, status: 'embedding', embedded: 1 } }),
        ]),
        'published',
      ),
    ).toMatchObject({ key: 'indexing', label: 'Indexing 1 of 3', busy: true });
    expect(
      documentState(
        doc([
          version({
            embedding: {
              ...version().embedding!,
              status: 'failed',
              failureCode: 'budget_exceeded',
            },
          }),
        ]),
        'published',
      ),
    ).toMatchObject({
      key: 'index_failed',
      detail: 'The institute’s AI budget for the month is used up.',
    });
    expect(documentState(doc([version()]), 'archived')).toMatchObject({ key: 'withdrawn' });
  });

  it('keeps the previous version answering while a new one fails to be read', () => {
    const state = documentState(
      doc([
        version(),
        version({
          id: '0190a0e4-7c1d-7b9e-8f00-0000000000d2',
          version: 2,
          status: 'failed',
          isCurrent: false,
          failureCode: 'content_too_large',
          embedding: null,
        }),
      ]),
      'published',
    );
    expect(state.key).toBe('read_failed');
    expect(state.detail).toMatch(/200,000 characters/);
    expect(state.detail).toMatch(/previous version still answers/);
  });
});

describe('a chosen file', () => {
  const file = (name: string, content: BlobPart, size?: number) => {
    const made = new File([content], name);
    if (size !== undefined) Object.defineProperty(made, 'size', { value: size });
    return made;
  };

  it('is read when it is Markdown, text or HTML within the limit', async () => {
    expect(await readKnowledgeFile(file('Notes.MD', '# Loops\n\nA loop repeats.'))).toEqual({
      ok: true,
      fileName: 'Notes.MD',
      content: '# Loops\n\nA loop repeats.',
    });
  });

  it('is refused before anything is sent otherwise', async () => {
    const refused = async (made: File) => {
      const read = await readKnowledgeFile(made);
      expect(read.ok, made.name).toBe(false);
      return read.ok ? '' : read.error;
    };
    expect(await refused(file('scan.pdf', '%PDF-1.7'))).toMatch(/Markdown, text or HTML/);
    expect(await refused(file('empty.md', ''))).toMatch(/empty/);
    expect(await refused(file('big.txt', 'x', KNOWLEDGE_UPLOAD_MAX_BYTES + 1))).toMatch(
      /largest file/,
    );
    expect(await refused(file('binary.txt', new Uint8Array([0x41, 0x00, 0x42, 0xff])))).toMatch(
      /not UTF-8 text/,
    );
  });

  it('suggests a title from its name', () => {
    expect(titleFromFileName('java_collections-notes.md')).toBe('Java collections notes');
    expect(titleFromFileName('.md')).toBe('');
  });
});

describe('the Knowledge base page', () => {
  it('lists every source with who it is for, and where the knowledge base stands', async () => {
    mocks.api.mockImplementation(async (path: string) => {
      if (path === '/ai/knowledge/status') {
        return {
          sources: { draft: 1, published: 2, archived: 0 },
          versions: { pending: 0, processing: 1, chunked: 5, failed: 1 },
          chunks: 42,
          embeddings: 40,
          vector: { extension: 'vector', available: true, installed: true, version: '0.8.2' },
        };
      }
      if (path === '/ai/knowledge/sources') {
        return [
          { ...source({ status: 'draft' }), documents: undefined },
          {
            ...source({
              id: '0190a0e4-7c1d-7b9e-8f00-0000000000a2',
              name: 'Staff handbook',
              audience: 'staff',
              courseId: null,
              course: null,
              dataClass: 'public',
            }),
            documents: undefined,
          },
        ];
      }
      throw new Error(`unexpected ${path}`);
    });
    renderWith(<KnowledgeSources />, MANAGER);
    const table = await screen.findByRole('table');
    expect(within(table).getByRole('link', { name: 'Core Java notes' }).getAttribute('href')).toBe(
      `/admin/knowledge/${SOURCE}`,
    );
    expect(within(table).getByText('Core Java')).toBeTruthy();
    expect(within(table).getByText('Staff only')).toBeTruthy();
    expect(screen.getByText('Indexed passages')).toBeTruthy();
    expect(screen.getByText('40')).toBeTruthy();
  });

  it('says what to do when there is no knowledge yet', async () => {
    mocks.api.mockImplementation(async (path: string) =>
      path === '/ai/knowledge/sources'
        ? []
        : {
            sources: { draft: 0, published: 0, archived: 0 },
            versions: { pending: 0, processing: 0, chunked: 0, failed: 0 },
            chunks: 0,
            embeddings: 0,
            vector: { extension: 'vector', available: true, installed: true, version: '0.8.2' },
          },
    );
    renderWith(<KnowledgeSources />, MANAGER);
    expect(await screen.findByText('No knowledge yet')).toBeTruthy();
  });
});

describe('a knowledge source', () => {
  const ready = document('0190a0e4-7c1d-7b9e-8f00-0000000000e1', 'Collections guide', [version()], {
    id: '0190a0e4-7c1d-7b9e-8f00-0000000000f1',
    title: 'Lists and maps',
    moduleId: '0190a0e4-7c1d-7b9e-8f00-0000000000f2',
    moduleTitle: 'Collections',
  });
  const broken = document('0190a0e4-7c1d-7b9e-8f00-0000000000e2', 'Exceptions guide', [
    version({
      id: '0190a0e4-7c1d-7b9e-8f00-0000000000d3',
      status: 'failed',
      isCurrent: false,
      chunkCount: 0,
      failureCode: 'malformed_content',
      embedding: null,
    }),
  ]);

  it('shows each document’s lesson and state, and why one failed', async () => {
    mocks.api.mockResolvedValue(source({ documents: [ready, broken] }));
    renderWith(<KnowledgeSourceWorkspace sourceId={SOURCE} />, MANAGER);
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(within(rows[1]!).getByText('Lists and maps')).toBeTruthy();
    expect(within(rows[1]!).getByText('Collections')).toBeTruthy();
    expect(within(rows[1]!).getByText('Ready')).toBeTruthy();
    expect(within(rows[2]!).getByText('Whole course')).toBeTruthy();
    expect(within(rows[2]!).getByText('Could not read')).toBeTruthy();
    expect(within(rows[2]!).getByText(/Save it as UTF-8/)).toBeTruthy();
  });

  it('tries a question over this source, and shows the answer with its sources', async () => {
    mocks.api.mockImplementation(async (path: string, init?: { body?: unknown }) => {
      if (path === `/ai/knowledge/sources/${SOURCE}`) return source({ documents: [ready] });
      if (path === '/ai/knowledge/preview') {
        expect(init?.body).toEqual({ query: 'What does a HashMap keep?', sourceId: SOURCE });
        return {
          status: 'answered',
          answer: 'A HashMap keeps keys and their values [S1].',
          citations: [
            {
              id: 'S1',
              chunkId: '0190a0e4-7c1d-7b9e-8f00-000000000c01',
              sourceId: SOURCE,
              sourceName: 'Core Java notes',
              documentId: ready.id,
              versionId: ready.versions[0]!.id,
              title: 'Collections guide',
              heading: 'Maps',
              position: 1,
              courseId: COURSE,
              lessonId: null,
              similarity: 0.83,
            },
          ],
          context: { courseId: null, lessonId: null },
          evidence: { retrieved: 4, used: 2 },
          usage: null,
        };
      }
      throw new Error(`unexpected ${path}`);
    });
    renderWith(<KnowledgeSourceWorkspace sourceId={SOURCE} />, MANAGER);
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Try a question' }), { button: 0 });
    fireEvent.change(await screen.findByLabelText('Question'), {
      target: { value: 'What does a HashMap keep?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText('Answered from the documents')).toBeTruthy();
    expect(screen.getByText('A HashMap keeps keys and their values [S1].')).toBeTruthy();
    expect(screen.getByText('Collections guide')).toBeTruthy();
    expect(screen.getByText(/83% match/)).toBeTruthy();
  });

  it('deletes a document only once it is confirmed', async () => {
    mocks.api.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path === `/ai/knowledge/sources/${SOURCE}`) return source({ documents: [ready] });
      if (path === `/ai/knowledge/documents/${ready.id}` && init?.method === 'DELETE')
        return undefined;
      throw new Error(`unexpected ${init?.method ?? 'GET'} ${path}`);
    });
    renderWith(<KnowledgeSourceWorkspace sourceId={SOURCE} />, MANAGER);
    fireEvent.keyDown(
      await screen.findByRole('button', { name: 'Actions for Collections guide' }),
      {
        key: 'Enter',
      },
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/removed for good/)).toBeTruthy();
    expect(mocks.api).not.toHaveBeenCalledWith(
      `/ai/knowledge/documents/${ready.id}`,
      expect.anything(),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete for good' }));
    await waitFor(() =>
      expect(mocks.api).toHaveBeenCalledWith(`/ai/knowledge/documents/${ready.id}`, {
        method: 'DELETE',
      }),
    );
  });
});
