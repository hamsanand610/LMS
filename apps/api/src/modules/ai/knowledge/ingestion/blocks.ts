/**
 * A document's structure as ingestion reads it (Phase 8B; ADR-0034): headings, paragraphs,
 * quotations, lists, code and tables, in their order. Every format is read into these blocks and
 * every chunk is written from them, so Markdown, plain text and HTML are cut by the same rules and
 * their chunks share one written form: Markdown.
 */
export type KnowledgeBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'list'; items: KnowledgeListItem[] }
  | { kind: 'code'; language: string; text: string }
  | { kind: 'table'; rows: string[][] };

/** One item of a list: how deep it sits, its marker (`-`, or a number such as `2.`), its text. */
export interface KnowledgeListItem {
  depth: number;
  marker: string;
  text: string;
}

/** A block as chunk text. */
export function renderBlock(block: KnowledgeBlock): string {
  switch (block.kind) {
    case 'heading':
      return `${'#'.repeat(block.level)} ${block.text}`;
    case 'paragraph':
      return block.text;
    case 'quote':
      return block.text
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n');
    case 'list':
      return block.items.map(renderListItem).join('\n');
    case 'code': {
      const fence = fenceFor(block.text);
      return `${fence}${block.language}\n${block.text}\n${fence}`;
    }
    case 'table':
      return renderTable(block.rows);
  }
}

/** An item under its marker, its further lines hanging under its text. */
export function renderListItem(item: KnowledgeListItem): string {
  const indent = '  '.repeat(item.depth);
  const hang = ' '.repeat(indent.length + item.marker.length + 1);
  return `${indent}${item.marker} ${item.text.split('\n').join(`\n${hang}`)}`;
}

/** A fence longer than any run of backticks inside the code, so the code never closes it early. */
export function fenceFor(code: string): string {
  let longest = 0;
  for (const run of code.matchAll(/`+/g)) longest = Math.max(longest, run[0].length);
  return '`'.repeat(Math.max(3, longest + 1));
}

/** Rows as a Markdown table: the first row is its header, and every row is as wide as the widest. */
export function renderTable(rows: readonly (readonly string[])[]): string {
  let width = 1;
  for (const row of rows) width = Math.max(width, row.length);
  const line = (cells: readonly string[]) =>
    `| ${Array.from({ length: width }, (_, index) => cells[index] ?? '').join(' | ')} |`;
  const [header = [], ...body] = rows;
  return [line(header), line(Array.from({ length: width }, () => '---')), ...body.map(line)].join(
    '\n',
  );
}
