import { describe, expect, it } from 'vitest';
import { JAVA_INHERITANCE_TEXT } from '../../../../../test/fixtures/java-inheritance-basics.js';
import {
  courseNotes,
  courseNotesHtml,
} from '../../../../../test/fixtures/knowledge-course-notes.js';
import { KNOWLEDGE_CHUNKING } from './chunker.js';
import { KnowledgeIngestionError } from './errors.js';
import { decodeKnowledgeText, normaliseSource } from './normalize.js';
import {
  KNOWLEDGE_INGESTION_LIMITS,
  extractKnowledge,
  formatOfMime,
  parserVersionOf,
} from './pipeline.js';

const char = (code: number) => String.fromCharCode(code);
const BOM = char(0xfeff);
const ZERO_WIDTH_SPACE = char(0x200b);
const ZERO_WIDTH_JOINER = char(0x200d);
const COMBINING_ACUTE = char(0x0301);
const E_ACUTE = char(0xe9);

function failureOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof KnowledgeIngestionError) return error.code;
    throw error;
  }
  return 'none';
}

describe('the ingestion pipeline (Phase 8B)', () => {
  it('normalises every form of the same content to the same chunks', () => {
    const canonical = `# Caf${E_ACUTE} notes\n\nOne paragraph.\n\n## Part\n\nAnother paragraph.`;
    const variants = [
      canonical.replace(/\n/g, '\r\n'),
      `${BOM}${canonical}`,
      canonical.replace(E_ACUTE, `e${COMBINING_ACUTE}`),
      canonical.replace(/\n/g, '   \n'),
      canonical.replace('One', `On${ZERO_WIDTH_SPACE}e`),
      `\n\n\n${canonical}\n\n\n`,
    ];
    const expected = extractKnowledge(canonical, 'markdown');
    for (const variant of variants) {
      expect(extractKnowledge(variant, 'markdown')).toEqual(expected);
    }
  });

  it('removes only what carries no meaning: control and zero-width characters, never letters', () => {
    const joined = `a${ZERO_WIDTH_JOINER}b`;
    expect(normaliseSource(`${joined}${char(0x07)}${ZERO_WIDTH_SPACE}c\r\nD.`)).toBe(
      `${joined}c\nD.`,
    );
    expect(normaliseSource('Keep CASE, punctuation!? and "quotes".')).toBe(
      'Keep CASE, punctuation!? and "quotes".',
    );
  });

  it('gives the same output for the same input, every time and in every format', () => {
    for (const [text, format] of [
      [courseNotes(20), 'markdown'],
      [courseNotesHtml(8), 'html'],
      [JAVA_INHERITANCE_TEXT, 'text'],
    ] as const) {
      expect(extractKnowledge(text, format)).toEqual(extractKnowledge(text, format));
    }
  });

  it('refuses what has no text: blank content, or HTML of scripts and styles alone', () => {
    expect(failureOf(() => extractKnowledge(' \n\t\n ', 'markdown'))).toBe('empty_content');
    expect(failureOf(() => extractKnowledge('\n\n', 'text'))).toBe('empty_content');
    expect(
      failureOf(() => extractKnowledge('<script>a()</script><style>p{}</style>', 'html')),
    ).toBe('empty_content');
  });

  it('refuses bytes that are not UTF-8, and text beyond its limits, the same way every time', () => {
    const malformed = new Uint8Array([0x48, 0x69, 0xff, 0xfe, 0x21]);
    expect(failureOf(() => decodeKnowledgeText(malformed))).toBe('malformed_content');
    expect(decodeKnowledgeText(new TextEncoder().encode(`${BOM}Hi`))).toBe('Hi');

    const long = courseNotes(10);
    expect(
      failureOf(() =>
        extractKnowledge(long, 'markdown', KNOWLEDGE_CHUNKING, {
          textCharacters: 1000,
          chunks: 1000,
        }),
      ),
    ).toBe('content_too_large');
    expect(
      failureOf(() =>
        extractKnowledge(long, 'markdown', KNOWLEDGE_CHUNKING, {
          textCharacters: 200_000,
          chunks: 3,
        }),
      ),
    ).toBe('too_many_chunks');
  });

  it('takes a moderately sized document whole, within the limits', () => {
    const result = extractKnowledge(courseNotes(40), 'markdown');
    expect(result.characters).toBeGreaterThan(100_000);
    expect(result.characters).toBeLessThanOrEqual(KNOWLEDGE_INGESTION_LIMITS.textCharacters);
    expect(result.chunks.length).toBeLessThanOrEqual(KNOWLEDGE_INGESTION_LIMITS.chunks);
    expect(result.chunkerVersion).toBe('sections-1/1200-2000-200-200');
  });

  it('names its parser by format, and reads only the types it knows', () => {
    expect(parserVersionOf('markdown')).toBe('markdown-1');
    expect(formatOfMime('text/markdown')).toBe('markdown');
    expect(formatOfMime('text/plain')).toBe('text');
    expect(formatOfMime('text/html')).toBe('html');
    expect(formatOfMime('application/pdf')).toBeNull();
    expect(extractKnowledge('<h2>T</h2><p>Words.</p>', 'html').parserVersion).toBe('html-1');
  });
});
