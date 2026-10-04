import {
  KNOWLEDGE_FORMAT_MIME,
  KNOWLEDGE_TEXT_MAX_CHARACTERS,
  type KnowledgeVersionFormat,
} from '@lms/shared';
import { type KnowledgeBlock, renderBlock } from './blocks.js';
import {
  KNOWLEDGE_CHUNKING,
  type KnowledgeChunkDraft,
  type KnowledgeChunkingOptions,
  chunkBlocks,
  chunkerVersionOf,
} from './chunker.js';
import { KnowledgeIngestionError } from './errors.js';
import { parseHtml } from './html.js';
import { parseMarkdown, parsePlainText } from './markdown.js';
import { normaliseSource } from './normalize.js';

/** Bumped whenever normalisation or a parser would read the same content differently. */
export const KNOWLEDGE_PARSER_REVISION = 1;

/**
 * The limits that keep one version's ingestion bounded (Phase 8B; ADR-0034). Generous for a
 * chapter of course material, and small enough that no version can hold a worker for long.
 */
export const KNOWLEDGE_INGESTION_LIMITS = {
  /** The most bytes read from storage for one version: 500,000 characters at their widest. */
  sourceBytes: 2 * 1024 * 1024,
  /** The most text kept once markup is gone. */
  textCharacters: KNOWLEDGE_TEXT_MAX_CHARACTERS,
  /** The most chunks one version may have. */
  chunks: 1000,
  /** How long one ingestion may take before it gives up. */
  deadlineMs: 60_000,
  /** How long a claim holds before another ingestion may take the version over. */
  leaseMs: 10 * 60_000,
} as const;

export function parserVersionOf(format: KnowledgeVersionFormat): string {
  return `${format}-${KNOWLEDGE_PARSER_REVISION}`;
}

/** The format a stored version is read in, from its media type; none for any other type. */
export function formatOfMime(mime: string): KnowledgeVersionFormat | null {
  for (const [format, type] of Object.entries(KNOWLEDGE_FORMAT_MIME)) {
    if (type === mime) return format as KnowledgeVersionFormat;
  }
  return null;
}

/** Text in one of the formats, normalised and read into its blocks. */
export function readStructure(text: string, format: KnowledgeVersionFormat): KnowledgeBlock[] {
  const source = normaliseSource(text);
  switch (format) {
    case 'markdown':
      return parseMarkdown(source);
    case 'text':
      return parsePlainText(source);
    case 'html':
      return parseHtml(source);
  }
}

/** What a version yields: its chunks, and which parser and chunker cut them. */
export interface ExtractedKnowledge {
  parserVersion: string;
  chunkerVersion: string;
  /** The length of the document's text as its chunks are written from it. */
  characters: number;
  chunks: KnowledgeChunkDraft[];
}

/**
 * A version's text to its chunks (Phase 8B): normalised, read into blocks, measured, chunked. Pure
 * and deterministic: the same text, format and options always give the same chunks. Every way it
 * can fail is a `KnowledgeIngestionError` with the code the version records.
 */
export function extractKnowledge(
  text: string,
  format: KnowledgeVersionFormat,
  options: KnowledgeChunkingOptions = KNOWLEDGE_CHUNKING,
  limits: { textCharacters: number; chunks: number } = KNOWLEDGE_INGESTION_LIMITS,
): ExtractedKnowledge {
  let blocks: KnowledgeBlock[];
  try {
    blocks = readStructure(text, format);
  } catch (error) {
    if (error instanceof KnowledgeIngestionError) throw error;
    throw new KnowledgeIngestionError('parser_failed', `The ${format} reader stopped`);
  }
  const characters = blocks.reduce(
    (sum, block, index) => sum + renderBlock(block).length + (index > 0 ? 2 : 0),
    0,
  );
  if (characters === 0) {
    throw new KnowledgeIngestionError('empty_content', 'No text is left once markup is gone');
  }
  if (characters > limits.textCharacters) {
    throw new KnowledgeIngestionError(
      'content_too_large',
      `The text is ${characters} characters; at most ${limits.textCharacters} are taken`,
    );
  }
  let chunks: KnowledgeChunkDraft[];
  try {
    chunks = chunkBlocks(blocks, options);
  } catch {
    throw new KnowledgeIngestionError('chunking_failed', 'The chunker stopped');
  }
  if (chunks.length === 0) {
    throw new KnowledgeIngestionError('empty_content', 'The text gave no chunk');
  }
  if (chunks.length > limits.chunks) {
    throw new KnowledgeIngestionError(
      'too_many_chunks',
      `The text gives ${chunks.length} chunks; at most ${limits.chunks} are kept`,
    );
  }
  if (
    chunks.some((chunk) => !chunk.content.trim() || chunk.content.length > options.maxCharacters)
  ) {
    throw new KnowledgeIngestionError('chunking_failed', 'A chunk broke the limits of the chunker');
  }
  return {
    parserVersion: parserVersionOf(format),
    chunkerVersion: chunkerVersionOf(options),
    characters,
    chunks,
  };
}
