import type { KnowledgeBlock, KnowledgeListItem } from './blocks.js';

/**
 * Markdown and plain text as blocks (Phase 8B; ADR-0034): CommonMark's block structure with
 * GitHub's tables, read deterministically. Markdown is taken as written: HTML inside it stays text,
 * because a lesson about HTML must keep its tags; an HTML source is read as HTML instead.
 */

interface Fence {
  char: string;
  length: number;
  indent: number;
  language: string;
}

const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/;
const THEMATIC = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const SETEXT = /^ {0,3}(?:=+|-+)[ \t]*$/;
const QUOTE = /^ {0,3}> ?(.*)$/;
const ITEM = /^( *)([-*+]|\d{1,9}[.)])(?:[ \t]+(.*))?$/;
const DELIMITER = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
const INDENTED = /^(?: {4}|\t)/;
const LANGUAGE = /^[\w+#.-]{1,30}$/;

/** Markdown as blocks: headings, paragraphs, quotations, lists, fenced and indented code, tables. */
export function parseMarkdown(source: string): KnowledgeBlock[] {
  const lines = source.split('\n').map((line) => line.replace(/[ \t]+$/, ''));
  const blocks: KnowledgeBlock[] = [];
  let paragraph: string[] = [];
  const endParagraph = () => {
    const text = paragraph.map(inline).filter(Boolean).join('\n');
    if (text) blocks.push({ kind: 'paragraph', text });
    paragraph = [];
  };

  let at = 0;
  while (at < lines.length) {
    const line = lines[at]!;
    if (!line.trim()) {
      endParagraph();
      at += 1;
      continue;
    }
    const fence = fenceOf(line);
    if (fence) {
      endParagraph();
      const indent = new RegExp(`^ {0,${fence.indent}}`);
      const body: string[] = [];
      at += 1;
      while (at < lines.length && !closes(lines[at]!, fence)) {
        body.push(lines[at]!.replace(indent, ''));
        at += 1;
      }
      at += 1; // the closing fence; an unclosed fence runs to the end, as CommonMark reads it
      const text = withoutBlankEdges(body).join('\n');
      if (text.trim()) blocks.push({ kind: 'code', language: fence.language, text });
      continue;
    }
    if (paragraph.length > 0 && SETEXT.test(line)) {
      const text = paragraph.map(inline).filter(Boolean).join(' ');
      paragraph = [];
      if (text) blocks.push({ kind: 'heading', level: line.trim().startsWith('=') ? 1 : 2, text });
      at += 1;
      continue;
    }
    const atx = ATX.exec(line);
    if (atx) {
      endParagraph();
      const text = inline((atx[2] ?? '').replace(/(?:^|[ \t]+)#+$/, ''));
      if (text) blocks.push({ kind: 'heading', level: atx[1]!.length, text });
      at += 1;
      continue;
    }
    if (THEMATIC.test(line)) {
      endParagraph();
      at += 1;
      continue;
    }
    if (QUOTE.test(line)) {
      endParagraph();
      const body: string[] = [];
      while (at < lines.length && QUOTE.test(lines[at]!)) {
        body.push(inline(QUOTE.exec(lines[at]!)![1]!));
        at += 1;
      }
      const text = withoutBlankEdges(body)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');
      if (text) blocks.push({ kind: 'quote', text });
      continue;
    }
    if (tableAt(lines, at)) {
      endParagraph();
      const rows = [cellsOf(lines[at]!)];
      at += 2; // the header and its delimiter row
      while (at < lines.length && lines[at]!.includes('|')) {
        rows.push(cellsOf(lines[at]!));
        at += 1;
      }
      blocks.push({ kind: 'table', rows });
      continue;
    }
    const item = ITEM.exec(line);
    if (item && (paragraph.length === 0 || interrupts(item))) {
      endParagraph();
      const list = readList(lines, at);
      if (list.items.length > 0) blocks.push({ kind: 'list', items: list.items });
      at = list.next;
      continue;
    }
    if (paragraph.length === 0 && INDENTED.test(line)) {
      const body: string[] = [];
      while (at < lines.length && (INDENTED.test(lines[at]!) || !lines[at]!.trim())) {
        body.push(lines[at]!.replace(INDENTED, ''));
        at += 1;
      }
      const text = withoutBlankEdges(body).join('\n');
      if (text.trim()) blocks.push({ kind: 'code', language: '', text });
      continue;
    }
    paragraph.push(line);
    at += 1;
  }
  endParagraph();
  return blocks;
}

/** Plain text as paragraphs: blank lines part them, and every line is kept as it was written. */
export function parsePlainText(source: string): KnowledgeBlock[] {
  const blocks: KnowledgeBlock[] = [];
  for (const part of source.split(/\n[ \t]*\n/)) {
    const text = withoutBlankEdges(part.split('\n').map((line) => line.replace(/[ \t]+$/, '')))
      .join('\n')
      .replace(/\n{2,}/g, '\n');
    if (text.trim()) blocks.push({ kind: 'paragraph', text });
  }
  return blocks;
}

/** A list from its first item: its items, nested by indentation, and the line after it. */
function readList(
  lines: readonly string[],
  start: number,
): { items: KnowledgeListItem[]; next: number } {
  const base = ITEM.exec(lines[start]!)![1]!.length;
  const items: KnowledgeListItem[] = [];
  let current: KnowledgeListItem | null = null;
  let hang = 0;
  let at = start;
  while (at < lines.length) {
    const line = lines[at]!;
    if (!line.trim()) {
      // A blank line: the list goes on only if an item, or a line indented under one, follows.
      let next = at + 1;
      while (next < lines.length && !lines[next]!.trim()) next += 1;
      if (next >= lines.length) break;
      const following = lines[next]!;
      const nextItem = itemOf(following, base);
      const underCurrent = current !== null && hang > 0 && indentOf(following) >= hang;
      if (!nextItem && !underCurrent) break;
      if (!nextItem && current?.text) current.text += '\n';
      at = next;
      continue;
    }
    const item = itemOf(line, base);
    if (item) {
      current = {
        depth: Math.min(6, Math.floor((item[1]!.length - base) / 2)),
        marker: /^\d/.test(item[2]!) ? `${item[2]!.slice(0, -1)}.` : '-',
        text: inline(item[3] ?? ''),
      };
      items.push(current);
      hang = item[1]!.length + item[2]!.length + 1;
      at += 1;
      continue;
    }
    if (current && (indentOf(line) > base || !startsBlock(line))) {
      const text = inline(line);
      current.text = current.text ? `${current.text}\n${text}` : text;
      at += 1;
      continue;
    }
    break;
  }
  return { items: items.filter((item) => item.text.trim()), next: at };
}

function itemOf(line: string, base: number): RegExpExecArray | null {
  const item = ITEM.exec(line);
  return item && item[1]!.length >= base && !THEMATIC.test(line) ? item : null;
}

/** Only a bullet, or a list counted from 1, may begin in the middle of a paragraph. */
function interrupts(item: RegExpExecArray): boolean {
  return Boolean(item[3]?.trim()) && /^(?:[-*+]|1[.)])$/.test(item[2]!);
}

function startsBlock(line: string): boolean {
  return ATX.test(line) || fenceOf(line) !== null || QUOTE.test(line) || THEMATIC.test(line);
}

function fenceOf(line: string): Fence | null {
  const match = FENCE_OPEN.exec(line);
  if (!match) return null;
  const marker = match[2]!;
  const info = match[3]!.trim();
  if (marker.startsWith('`') && info.includes('`')) return null;
  const word = info.split(/\s+/)[0] ?? '';
  return {
    char: marker[0]!,
    length: marker.length,
    indent: match[1]!.length,
    language: LANGUAGE.test(word) ? word : '',
  };
}

function closes(line: string, fence: Fence): boolean {
  const match = FENCE_CLOSE.exec(line);
  return match !== null && match[1]![0] === fence.char && match[1]!.length >= fence.length;
}

function tableAt(lines: readonly string[], at: number): boolean {
  const header = lines[at]!;
  const delimiter = lines[at + 1];
  return (
    header.includes('|') &&
    delimiter !== undefined &&
    delimiter.includes('|') &&
    DELIMITER.test(delimiter) &&
    cellsOf(header).length === cellsOf(delimiter).length
  );
}

function cellsOf(line: string): string[] {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  return row.split(/(?<!\\)\|/).map(inline);
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/** A line's words, with its runs of spaces made one. */
function inline(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function withoutBlankEdges(lines: readonly string[]): string[] {
  let first = 0;
  let last = lines.length;
  while (first < last && !lines[first]!.trim()) first += 1;
  while (last > first && !lines[last - 1]!.trim()) last -= 1;
  return lines.slice(first, last);
}
