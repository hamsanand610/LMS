import {
  type KnowledgeBlock,
  type KnowledgeListItem,
  fenceFor,
  renderBlock,
  renderListItem,
  renderTable,
} from './blocks.js';

/**
 * How chunks are sized (Phase 8B; ADR-0034), in characters: the platform counts text in characters
 * and estimates tokens from them (a quarter), so a 1,200-character chunk is about 300 tokens, well
 * inside any embedding model's input.
 */
export interface KnowledgeChunkingOptions {
  /** A chunk is filled up to this size when its section's content allows. */
  targetCharacters: number;
  /** No chunk is longer: a longer section, paragraph, list, table or code block is split. */
  maxCharacters: number;
  /** A chunk shorter than this joins its neighbour when the two fit. */
  minCharacters: number;
  /** The last sentence of a paragraph split across chunks starts the next one, up to this long. */
  overlapCharacters: number;
}

export const KNOWLEDGE_CHUNKING: KnowledgeChunkingOptions = {
  targetCharacters: 1200,
  maxCharacters: 2000,
  minCharacters: 200,
  overlapCharacters: 200,
};

/** Bumped whenever the chunker would cut the same content differently. */
const CHUNKER = 'sections-1';

/** The chunker's name with its sizes: one value, so a change of either is a change of version. */
export function chunkerVersionOf(options: KnowledgeChunkingOptions = KNOWLEDGE_CHUNKING): string {
  const { targetCharacters, maxCharacters, minCharacters, overlapCharacters } = options;
  return `${CHUNKER}/${targetCharacters}-${maxCharacters}-${minCharacters}-${overlapCharacters}`;
}

/** A chunk before it is recorded: its section, as a path of headings, and its text. */
export interface KnowledgeChunkDraft {
  heading: string;
  content: string;
}

/** Headings of the sections a chunk belongs to, outermost first. */
export const HEADING_PATH_SEPARATOR = ' > ';

/**
 * A sentence ends at `.`, `!`, `?` or the Devanagari danda, perhaps closed by quotes or brackets,
 * where the next one begins with a capital, a digit or a letter of a script without case. The
 * whitespace is matched first and looked behind from (Phase 8F): the same breaks, in linear time —
 * a look-behind tried at every position took quadratic time on a long run of closing brackets.
 */
const SENTENCE_BREAK =
  /\s+(?<=[.!?\u0964]["'\u2019\u201d)\]]*\s+)(?=["'\u2018\u201c([]?[\p{Lu}\p{Lo}\p{Nd}])/u;

interface Section {
  path: string[];
  heading: string | null;
  blocks: KnowledgeBlock[];
}

interface Unit {
  path: string[];
  text: string;
}

/** Part of a block too long to stay whole, and how it joins the part before it. */
interface Piece {
  text: string;
  joiner: string;
  /** Sentences of one paragraph share a group; only they may overlap. */
  group?: number;
  /** Repeated from the chunk before: dropped again if the two chunks are joined. */
  overlap?: boolean;
}

/**
 * Blocks as chunks, deterministically: the same blocks and options always give the same chunks.
 *
 * 1. **Sections first.** Each heading opens a section; a section that fits within the maximum is
 *    one unit, whole.
 * 2. **Then blocks, sentences, words.** A longer section is cut between its blocks; a block longer
 *    than a chunk is cut by its own grain: a paragraph between sentences, a list between items, a
 *    table between rows (its header repeated), code between lines (fenced again). Every part of a
 *    cut section opens with its heading.
 * 3. **Small units join.** Consecutive units join while they fit the target, and a unit below the
 *    minimum joins its neighbour while the two fit the maximum.
 * 4. **Overlap, sparingly.** Only where a paragraph is cut: its last sentence before the cut, when no
 *    longer than the overlap, also starts the next chunk.
 *
 * Nothing is dropped: every character of every block is in a chunk.
 */
export function chunkBlocks(
  blocks: readonly KnowledgeBlock[],
  options: KnowledgeChunkingOptions = KNOWLEDGE_CHUNKING,
): KnowledgeChunkDraft[] {
  assertOptions(options);
  const units = sectionsOf(blocks).flatMap((section) => unitsOf(section, options));
  return gather(units, options).map(({ paths, text }) => ({
    heading: headingOf(paths),
    content: text,
  }));
}

function sectionsOf(blocks: readonly KnowledgeBlock[]): Section[] {
  const sections: Section[] = [];
  const open: { level: number; text: string }[] = [];
  let current: Section = { path: [], heading: null, blocks: [] };
  for (const block of blocks) {
    if (block.kind !== 'heading') {
      current.blocks.push(block);
      continue;
    }
    if (current.heading !== null || current.blocks.length > 0) sections.push(current);
    while (open.length > 0 && open[open.length - 1]!.level >= block.level) open.pop();
    open.push({ level: block.level, text: block.text });
    current = { path: open.map((h) => h.text), heading: renderBlock(block), blocks: [] };
  }
  if (current.heading !== null || current.blocks.length > 0) sections.push(current);
  return sections;
}

function unitsOf(section: Section, options: KnowledgeChunkingOptions): Unit[] {
  const parts = [...(section.heading ? [section.heading] : []), ...section.blocks.map(renderBlock)];
  const whole = parts.join('\n\n');
  if (!whole) return [];
  if (whole.length <= options.maxCharacters) return [{ path: section.path, text: whole }];
  return cutSection(section, options).map((text) => ({ path: section.path, text }));
}

/** A section longer than a chunk, in parts that each open with its heading. */
function cutSection(section: Section, options: KnowledgeChunkingOptions): string[] {
  let header = section.heading ? `${section.heading}\n\n` : '';
  let blocks = section.blocks;
  if (options.maxCharacters - header.length < options.minCharacters) {
    // A heading too long to open every part is the section's first words instead.
    blocks = [{ kind: 'paragraph', text: section.heading! }, ...blocks];
    header = '';
  }
  const budget = options.maxCharacters - header.length;
  const aim = Math.max(options.minCharacters, options.targetCharacters - header.length);
  const pieces = blocks.flatMap((block, index) => piecesOf(block, budget, index));

  const parts: Piece[][] = [];
  let current: Piece[] = [];
  let size = 0;
  for (const piece of pieces) {
    const added = (current.length > 0 ? piece.joiner.length : 0) + piece.text.length;
    const full = size + added > budget || (size + added > aim && size >= options.minCharacters);
    if (current.length > 0 && full) {
      parts.push(current);
      const carried = overlapOf(current, piece, budget, options);
      current = carried ? [carried] : [];
      size = carried ? carried.text.length : 0;
    }
    size += (current.length > 0 ? piece.joiner.length : 0) + piece.text.length;
    current.push(piece);
  }
  if (current.length > 0) parts.push(current);

  // A last part too short to stand alone joins the part before it, when the two fit.
  if (parts.length > 1) {
    const tail = parts[parts.length - 1]!.filter((piece) => !piece.overlap);
    const before = parts[parts.length - 2]!;
    const joined = [...before, ...tail];
    if (textOf(tail).length < options.minCharacters && textOf(joined).length <= budget) {
      parts.splice(parts.length - 2, 2, joined);
    }
  }
  return parts.map((part) => header + textOf(part));
}

/** The sentence a cut paragraph repeats at the next part's start, when it is short enough. */
function overlapOf(
  before: readonly Piece[],
  next: Piece,
  budget: number,
  options: KnowledgeChunkingOptions,
): Piece | null {
  const last = before[before.length - 1]!;
  if (last.group === undefined || last.group !== next.group) return null;
  if (last.text.length > options.overlapCharacters) return null;
  if (last.text.length + next.joiner.length + next.text.length > budget) return null;
  return { text: last.text, joiner: '\n\n', group: last.group, overlap: true };
}

function textOf(pieces: readonly Piece[]): string {
  return pieces.map((piece, index) => (index > 0 ? piece.joiner : '') + piece.text).join('');
}

/** A block in pieces no longer than the budget, cut by its own grain. */
function piecesOf(block: KnowledgeBlock, budget: number, index: number): Piece[] {
  const text = renderBlock(block);
  if (text.length <= budget) return [{ text, joiner: '\n\n' }];
  let pieces: Piece[];
  switch (block.kind) {
    case 'paragraph':
      pieces = sentencesOf(block.text, budget).map((sentence) => ({
        text: sentence,
        joiner: ' ',
        group: index,
      }));
      break;
    case 'quote':
      pieces = sentencesOf(block.text, budget - 2).map((sentence) => ({
        text: `> ${sentence}`,
        joiner: '\n',
      }));
      break;
    case 'list':
      pieces = listPieces(block.items, budget);
      break;
    case 'code':
      pieces = codePieces(block.language, block.text, budget);
      break;
    case 'table':
      pieces = tablePieces(block.rows, budget);
      break;
    default:
      // A heading longer than a chunk: its words.
      pieces = wordsOf(text, budget).map((words) => ({ text: words, joiner: ' ' }));
  }
  return pieces.map((piece, at) => (at === 0 ? { ...piece, joiner: '\n\n' } : piece));
}

/** A list cut between items: an item stays with the items nested under it while they fit. */
function listPieces(items: readonly KnowledgeListItem[], budget: number): Piece[] {
  let top = Infinity;
  for (const item of items) top = Math.min(top, item.depth);
  const groups: KnowledgeListItem[][] = [];
  for (const item of items) {
    if (item.depth === top || groups.length === 0) groups.push([item]);
    else groups[groups.length - 1]!.push(item);
  }
  const pieces: Piece[] = [];
  for (const group of groups) {
    const whole = group.map(renderListItem).join('\n');
    if (whole.length <= budget) {
      pieces.push({ text: whole, joiner: '\n' });
      continue;
    }
    for (const item of group) {
      const line = renderListItem(item);
      if (line.length <= budget) {
        pieces.push({ text: line, joiner: '\n' });
        continue;
      }
      const prefix = item.depth * 2 + item.marker.length + 1;
      for (const words of wordsOf(item.text.replace(/\n/g, ' '), budget - prefix)) {
        pieces.push({ text: renderListItem({ ...item, text: words }), joiner: '\n' });
      }
    }
  }
  return pieces;
}

/** Code cut between lines, each part fenced again; a line longer than a part is cut itself. */
function codePieces(language: string, code: string, budget: number): Piece[] {
  const fence = fenceFor(code);
  const room = budget - (fence.length * 2 + language.length + 2);
  const lines = code
    .split('\n')
    .flatMap((line) => (line.length <= room ? [line] : cut(line, room)));
  const parts: string[][] = [];
  let current: string[] = [];
  let size = 0;
  for (const line of lines) {
    const added = (current.length > 0 ? 1 : 0) + line.length;
    if (current.length > 0 && size + added > room) {
      parts.push(current);
      current = [];
      size = 0;
    }
    size += (current.length > 0 ? 1 : 0) + line.length;
    current.push(line);
  }
  if (current.length > 0) parts.push(current);
  return parts.map((part) => ({
    text: `${fence}${language}\n${part.join('\n')}\n${fence}`,
    joiner: '\n\n',
  }));
}

/** A table cut between rows, its header repeated on every part. */
function tablePieces(rows: readonly string[][], budget: number): Piece[] {
  const [header = [], ...body] = rows;
  const pieces: Piece[] = [];
  let current: string[][] = [];
  const close = () => {
    if (current.length > 0)
      pieces.push({ text: renderTable([header, ...current]), joiner: '\n\n' });
    current = [];
  };
  for (const row of body) {
    if (renderTable([header, row]).length > budget) {
      // A row too wide for any table: its cells as words.
      close();
      for (const words of wordsOf(row.join(' | '), budget))
        pieces.push({ text: words, joiner: '\n\n' });
      continue;
    }
    if (current.length > 0 && renderTable([header, ...current, row]).length > budget) close();
    current.push(row);
  }
  close();
  if (pieces.length === 0) {
    for (const words of wordsOf(header.join(' | '), budget))
      pieces.push({ text: words, joiner: '\n\n' });
  }
  return pieces;
}

/** A paragraph's sentences, each no longer than the budget. */
function sentencesOf(text: string, budget: number): string[] {
  return text
    .split(SENTENCE_BREAK)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .flatMap((sentence) => (sentence.length <= budget ? [sentence] : wordsOf(sentence, budget)));
}

/** Text cut between words into parts no longer than the limit; a word longer than it is cut. */
export function wordsOf(text: string, limit: number): string[] {
  if (limit < 1) throw new RangeError('No room for a part');
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > limit) {
    let at = limit;
    while (at > limit / 2 && !/\s/.test(rest[at]!)) at -= 1;
    if (at <= limit / 2) at = limit;
    at = safeCut(rest, at) || 2;
    parts.push(rest.slice(0, at).trimEnd());
    rest = rest.slice(at).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}

/** A line cut into parts of the given length, never between the halves of a surrogate pair. */
function cut(line: string, length: number): string[] {
  if (length < 1) throw new RangeError('No room for a part');
  const parts: string[] = [];
  let rest = line;
  while (rest.length > length) {
    // A part of one place that would split a surrogate pair takes the whole character instead.
    const at = safeCut(rest, length) || 2;
    parts.push(rest.slice(0, at));
    rest = rest.slice(at);
  }
  parts.push(rest);
  return parts;
}

function safeCut(text: string, at: number): number {
  const code = text.charCodeAt(at - 1);
  return code >= 0xd800 && code <= 0xdbff ? at - 1 : at;
}

/** Units gathered into chunks: neighbours join while they fit the target, small ones the maximum. */
function gather(
  units: readonly Unit[],
  options: KnowledgeChunkingOptions,
): { paths: string[][]; text: string }[] {
  const chunks: { paths: string[][]; text: string }[] = [];
  for (const unit of units) {
    const last = chunks[chunks.length - 1];
    if (last) {
      const joined = last.text.length + 2 + unit.text.length;
      if (
        joined <= options.targetCharacters ||
        (last.text.length < options.minCharacters && joined <= options.maxCharacters)
      ) {
        last.text = `${last.text}\n\n${unit.text}`;
        last.paths.push(unit.path);
        continue;
      }
    }
    chunks.push({ paths: [unit.path], text: unit.text });
  }
  if (chunks.length > 1) {
    const tail = chunks[chunks.length - 1]!;
    const before = chunks[chunks.length - 2]!;
    if (
      tail.text.length < options.minCharacters &&
      before.text.length + 2 + tail.text.length <= options.maxCharacters
    ) {
      before.text = `${before.text}\n\n${tail.text}`;
      before.paths.push(...tail.paths);
      chunks.pop();
    }
  }
  return chunks;
}

/** The headings every section of a chunk shares, else the first section's. */
function headingOf(paths: readonly string[][]): string {
  const first = paths[0] ?? [];
  let shared = first.length;
  for (const path of paths) {
    let at = 0;
    while (at < shared && at < path.length && path[at] === first[at]) at += 1;
    shared = at;
  }
  return (shared > 0 ? first.slice(0, shared) : first).join(HEADING_PATH_SEPARATOR);
}

function assertOptions(options: KnowledgeChunkingOptions): void {
  const { targetCharacters, maxCharacters, minCharacters, overlapCharacters } = options;
  const whole = [targetCharacters, maxCharacters, minCharacters, overlapCharacters].every(
    (value) => Number.isInteger(value) && value >= 0,
  );
  if (
    !whole ||
    minCharacters < 1 ||
    minCharacters > targetCharacters ||
    targetCharacters > maxCharacters ||
    overlapCharacters * 4 > maxCharacters ||
    maxCharacters < 40
  ) {
    throw new Error('Knowledge chunking options are inconsistent');
  }
}
