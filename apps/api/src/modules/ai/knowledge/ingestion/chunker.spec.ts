import { describe, expect, it } from 'vitest';
import { JAVA_INHERITANCE_TEXT } from '../../../../../test/fixtures/java-inheritance-basics.js';
import { courseNotes } from '../../../../../test/fixtures/knowledge-course-notes.js';
import { type KnowledgeBlock, renderBlock } from './blocks.js';
import {
  HEADING_PATH_SEPARATOR,
  KNOWLEDGE_CHUNKING,
  type KnowledgeChunkingOptions,
  chunkBlocks,
  chunkerVersionOf,
  wordsOf,
} from './chunker.js';
import { readStructure } from './pipeline.js';

const SMALL: KnowledgeChunkingOptions = {
  targetCharacters: 220,
  maxCharacters: 320,
  minCharacters: 80,
  overlapCharacters: 60,
};

const notes = () => readStructure(courseNotes(), 'markdown');

/** How often each word appears. */
function wordCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of text.split(/\s+/).filter(Boolean)) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}

function sentencesOf(count: number): string {
  return Array.from(
    { length: count },
    (_, i) => `Sentence number ${i} explains one more detail of the topic at hand.`,
  ).join(' ');
}

describe('the knowledge chunker (Phase 8B)', () => {
  it('cuts the same blocks into the same chunks, every time', () => {
    const first = chunkBlocks(notes());
    const second = chunkBlocks(notes());
    expect(second).toEqual(first);
    expect(first.length).toBeGreaterThan(40);
    expect(chunkerVersionOf(KNOWLEDGE_CHUNKING)).toBe('sections-1/1200-2000-200-200');
  });

  it('keeps every chunk within the maximum, and none needlessly small', () => {
    const chunks = chunkBlocks(notes());
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(KNOWLEDGE_CHUNKING.maxCharacters);
      expect(chunk.content.length).toBeGreaterThanOrEqual(KNOWLEDGE_CHUNKING.minCharacters);
      expect(chunk.content.trim()).toBe(chunk.content);
    }
    const sizes = chunks.map((chunk) => chunk.content.length);
    const average = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    expect(average).toBeGreaterThan(KNOWLEDGE_CHUNKING.targetCharacters / 2);
  });

  it('drops nothing: every word of the document is in a chunk', () => {
    const blocks = notes();
    const source = wordCounts(blocks.map(renderBlock).join('\n\n'));
    const chunked = wordCounts(
      chunkBlocks(blocks)
        .map((chunk) => chunk.content)
        .join('\n\n'),
    );
    for (const [word, count] of source) {
      expect(chunked.get(word) ?? 0, word).toBeGreaterThanOrEqual(count);
    }
  });

  it('names each chunk by its section, and opens every part of a cut section with its heading', () => {
    const chunks = chunkBlocks(notes());
    for (const chunk of chunks) {
      expect(chunk.heading.startsWith('Programming Course Notes')).toBe(true);
    }
    // Section 5's first paragraph is longer than a chunk: its section is cut, each part headed.
    const path = ['Programming Course Notes', '5. Working with interfaces'];
    const parts = chunks.filter((chunk) => chunk.heading === path.join(HEADING_PATH_SEPARATOR));
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(part.content.startsWith('## 5. Working with interfaces')).toBe(true);
    }
    const steps = chunks.find((chunk) => chunk.content.startsWith('### Steps for interfaces'));
    expect(steps?.heading).toBe([...path, 'Steps for interfaces'].join(HEADING_PATH_SEPARATOR));
  });

  it('joins small sections, and names the chunk by the headings they share', () => {
    const whole = chunkBlocks(readStructure(JAVA_INHERITANCE_TEXT, 'markdown'));
    expect(whole).toHaveLength(1);
    expect(whole[0]!.heading).toBe('Java Inheritance Basics');
    for (const section of ['Definition', 'Parent class', 'Child class', 'Method overriding']) {
      expect(whole[0]!.content).toContain(`## ${section}`);
    }
    const apart = chunkBlocks(readStructure(JAVA_INHERITANCE_TEXT, 'markdown'), SMALL);
    expect(apart.map((chunk) => chunk.heading)).toEqual([
      'Java Inheritance Basics',
      'Java Inheritance Basics > Parent class',
      'Java Inheritance Basics > Child class',
      'Java Inheritance Basics > Method overriding',
      'Java Inheritance Basics > Example',
    ]);
  });

  it('keeps a paragraph whole when it fits, and cuts a longer one between sentences, one overlapping', () => {
    const blocks: KnowledgeBlock[] = [
      { kind: 'heading', level: 2, text: 'Long' },
      { kind: 'paragraph', text: 'A short paragraph stays whole.' },
      { kind: 'paragraph', text: sentencesOf(40) },
    ];
    const chunks = chunkBlocks(blocks);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.content).toContain('A short paragraph stays whole.');
    for (const chunk of chunks) {
      expect(chunk.content.startsWith('## Long')).toBe(true);
      expect(chunk.content.endsWith('.')).toBe(true);
    }
    // The last sentence before each cut opens the next chunk, and nothing more is repeated.
    for (let i = 1; i < chunks.length; i += 1) {
      const before = chunks[i - 1]!.content;
      const last = before.slice(before.lastIndexOf('Sentence number'));
      const opening = chunks[i]!.content.replace('## Long\n\n', '');
      expect(last.length).toBeLessThanOrEqual(KNOWLEDGE_CHUNKING.overlapCharacters);
      expect(opening.startsWith(`${last} Sentence number`)).toBe(true);
    }
  });

  it('keeps a code block whole when it fits, and cuts a longer one between lines, fenced again', () => {
    const lines = Array.from(
      { length: 90 },
      (_, i) => `    int value${i} = ${i} * ${i}; // line ${i}`,
    );
    const blocks: KnowledgeBlock[] = [
      { kind: 'code', language: 'java', text: 'int small = 1;\nint other = 2;' },
      { kind: 'code', language: 'java', text: lines.join('\n') },
    ];
    const chunks = chunkBlocks(blocks);
    expect(chunks[0]!.content).toContain('```java\nint small = 1;\nint other = 2;\n```');
    const parts = chunks.flatMap((chunk) =>
      chunk.content.split('\n\n').filter((part) => part.includes('int value')),
    );
    expect(parts.length).toBeGreaterThan(1);
    const rejoined: string[] = [];
    for (const part of parts) {
      expect(part.startsWith('```java\n')).toBe(true);
      expect(part.endsWith('\n```')).toBe(true);
      rejoined.push(...part.split('\n').slice(1, -1));
    }
    expect(rejoined).toEqual(lines);
  });

  it('keeps list items with the items under them, and cuts a longer list between items', () => {
    const items = Array.from({ length: 12 }, (_, i) => [
      { depth: 0, marker: `${i + 1}.`, text: `Step ${i + 1} of the exercise.` },
      { depth: 1, marker: '-', text: `A note on step ${i + 1}.` },
    ]).flat();
    const chunks = chunkBlocks([{ kind: 'list', items }], SMALL);
    expect(chunks.length).toBeGreaterThan(1);
    const lines = chunks.flatMap((chunk) => chunk.content.split('\n'));
    expect(lines).toEqual(
      items.map((item) => `${'  '.repeat(item.depth)}${item.marker} ${item.text}`),
    );
    for (const chunk of chunks) {
      // Every part opens with a step, never with a note torn from its step.
      expect(chunk.content.startsWith('  -')).toBe(false);
    }
  });

  it('keeps a table readable: a longer one is cut between rows, its header repeated', () => {
    const rows = [
      ['Name', 'Kind'],
      ...Array.from({ length: 150 }, (_, i) => [`item-${i}`, `kind ${i}`]),
    ];
    const chunks = chunkBlocks([{ kind: 'table', rows }]);
    expect(chunks.length).toBeGreaterThan(1);
    const body: string[] = [];
    for (const chunk of chunks) {
      const lines = chunk.content.split('\n');
      expect(lines.slice(0, 2)).toEqual(['| Name | Kind |', '| --- | --- |']);
      body.push(...lines.slice(2));
    }
    expect(body).toEqual(rows.slice(1).map(([name, kind]) => `| ${name} | ${kind} |`));
  });

  it('stays within the maximum whatever it is given: long words, lines, rows and headings', () => {
    const word = 'x'.repeat(5000);
    const blocks: KnowledgeBlock[] = [
      { kind: 'heading', level: 1, text: `Heading ${'h'.repeat(2500)}` },
      { kind: 'paragraph', text: `${word} ${word}` },
      { kind: 'code', language: '', text: 'y'.repeat(4500) },
      {
        kind: 'table',
        rows: [
          ['a', 'b'],
          ['z'.repeat(3000), 'c'],
        ],
      },
      { kind: 'list', items: [{ depth: 0, marker: '-', text: 'w'.repeat(4100) }] },
    ];
    const chunks = chunkBlocks(blocks);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(KNOWLEDGE_CHUNKING.maxCharacters);
    }
    const letters = (text: string, letter: string) => text.split(letter).length - 1;
    const all = chunks.map((chunk) => chunk.content).join('');
    expect(letters(all, 'x')).toBeGreaterThanOrEqual(10000);
    expect(letters(all, 'y')).toBeGreaterThanOrEqual(4500);
    expect(letters(all, 'z')).toBeGreaterThanOrEqual(3000);
    expect(letters(all, 'w')).toBeGreaterThanOrEqual(4100);
  });

  it('never cuts between the two halves of a character', () => {
    const smile = String.fromCodePoint(0x1f600);
    const parts = wordsOf(smile.repeat(50), 7);
    expect(parts.join('')).toBe(smile.repeat(50));
    for (const part of parts) {
      const first = part.charCodeAt(0);
      const last = part.charCodeAt(part.length - 1);
      expect(first >= 0xdc00 && first <= 0xdfff).toBe(false);
      expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
    }
  });

  it('refuses sizes that contradict each other', () => {
    expect(() => chunkBlocks([], { ...KNOWLEDGE_CHUNKING, targetCharacters: 3000 })).toThrow();
    expect(() => chunkBlocks([], { ...KNOWLEDGE_CHUNKING, overlapCharacters: 900 })).toThrow();
  });
});
