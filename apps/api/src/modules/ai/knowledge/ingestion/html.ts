import sanitizeHtml from 'sanitize-html';
import { decodeHtmlEntities } from '../../../../core/html/text.js';
import type { KnowledgeBlock, KnowledgeListItem } from './blocks.js';

/**
 * What of an HTML source is knowledge (Phase 8B; ADR-0034): its structure (headings, paragraphs,
 * quotations, lists, code, tables) and the words inside. Scripts, styles, navigation, forms, frames,
 * images, comments and every attribute go, with whatever only a browser would have shown of them.
 * The platform's sanitiser parses the HTML; what it leaves is regular enough to read tag by tag.
 */
const KNOWLEDGE_HTML: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'br',
    'hr',
    'blockquote',
    'ul',
    'ol',
    'li',
    'dl',
    'dt',
    'dd',
    'pre',
    'code',
    'table',
    'caption',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'div',
    'section',
    'article',
    'main',
    'header',
    'figure',
    'figcaption',
    'details',
    'summary',
  ],
  allowedAttributes: { code: ['class'], pre: ['class'] },
  allowedClasses: { code: [/^language-[a-z0-9+#-]+$/], pre: [/^language-[a-z0-9+#-]+$/] },
  disallowedTagsMode: 'discard',
  nonTextTags: [
    'script',
    'style',
    'noscript',
    'template',
    'textarea',
    'option',
    'select',
    'button',
    'nav',
    'footer',
    'aside',
    'svg',
    'math',
    'iframe',
    'object',
    'embed',
    'canvas',
    'head',
    'title',
    'form',
  ],
};

/** A tag as the sanitiser writes it: lower case, with at most a `class`. */
const TAG = /<(\/?)([a-z][a-z0-9]*)(?:\s+class="([^"]*)")?\s*\/?>/g;
const HEADING = /^h([1-6])$/;

/** HTML as blocks. */
export function parseHtml(source: string): KnowledgeBlock[] {
  const clean = sanitizeHtml(source, KNOWLEDGE_HTML);
  const reader = new HtmlBlockReader();
  let last = 0;
  for (const match of clean.matchAll(TAG)) {
    reader.text(decodeHtmlEntities(clean.slice(last, match.index)));
    reader.tag(match[2]!, match[1] === '/', match[3] ?? '');
    last = match.index + match[0].length;
  }
  reader.text(decodeHtmlEntities(clean.slice(last)));
  return reader.finish();
}

interface OpenTable {
  rows: string[][];
  row: string[] | null;
  cell: string | null;
  caption: string;
  captioning: boolean;
}

/** Reads the sanitiser's output tag by tag into blocks; whitespace outside code is folded. */
class HtmlBlockReader {
  private readonly blocks: KnowledgeBlock[] = [];
  private inline = '';
  private quote = 0;
  private pre: { language: string; text: string } | null = null;
  private readonly lists: { ordered: boolean; next: number }[] = [];
  private items: KnowledgeListItem[] = [];
  private item: KnowledgeListItem | null = null;
  private table: OpenTable | null = null;
  private nestedTables = 0;

  text(value: string): void {
    if (!value) return;
    if (this.pre) {
      this.pre.text += value;
      return;
    }
    this.append(value.replace(/\s+/g, ' '));
  }

  tag(name: string, closing: boolean, className: string): void {
    if (this.pre) {
      if (name === 'pre' && closing) this.endPre();
      else if (name === 'code' && !closing && !this.pre.language) {
        this.pre.language = languageOf(className);
      } else if (name === 'br') this.pre.text += '\n';
      return;
    }
    const level = HEADING.exec(name);
    if (level) {
      // A heading inside a list or a table is that item's or that cell's words.
      if (this.lists.length > 0 || this.table) return;
      if (closing) this.endHeading(Number(level[1]));
      else this.flush();
      return;
    }
    switch (name) {
      case 'pre':
        if (!closing) this.startPre(languageOf(className));
        return;
      case 'code':
        this.append('`');
        return;
      case 'br':
        this.append(this.table ? ' ' : '\n');
        return;
      case 'ul':
      case 'ol':
        if (closing) this.endList();
        else this.startList(name === 'ol');
        return;
      case 'li':
        if (closing) this.commitItem();
        else this.startItem();
        return;
      case 'table':
        if (closing) this.endTable();
        else this.startTable();
        return;
      case 'tr':
        if (this.table && this.nestedTables === 0) {
          this.commitRow();
          if (!closing) this.table.row = [];
        }
        return;
      case 'th':
      case 'td':
        this.cell(closing);
        return;
      case 'caption':
        if (this.table) this.table.captioning = !closing;
        return;
      case 'thead':
      case 'tbody':
      case 'tfoot':
        return;
      case 'blockquote':
        this.flush();
        this.quote = Math.max(0, this.quote + (closing ? -1 : 1));
        return;
      default:
        // p, div, section, article, main, header, figure, figcaption, details, summary, dl, dt,
        // dd, hr: each ends what came before it.
        if (this.item) {
          if (closing && (name === 'p' || name === 'div')) this.item.text += '\n';
          return;
        }
        if (this.table) return;
        this.flush();
    }
  }

  finish(): KnowledgeBlock[] {
    if (this.pre) this.endPre();
    while (this.table) this.endTable();
    while (this.lists.length > 0) this.endList();
    this.commitItem();
    this.endListBlock();
    this.flush();
    return this.blocks;
  }

  /** Words (or a mark) to whatever is open: a cell, a caption, a list item, or the paragraph. */
  private append(value: string): void {
    if (this.table) {
      if (this.table.cell !== null) this.table.cell += value;
      else if (this.table.captioning) this.table.caption += value;
      return;
    }
    if (this.item) {
      this.item.text += value;
      return;
    }
    if (this.lists.length > 0) {
      // Words after a nested list or code, still inside the item that held them: they go on in
      // the last item, or begin one. They are never dropped.
      const last = this.items[this.items.length - 1];
      if (last) last.text += value;
      else this.item = { depth: this.lists.length - 1, marker: '-', text: value };
      return;
    }
    this.inline += value;
  }

  private flush(): void {
    const text = lines(this.inline);
    this.inline = '';
    if (!text) return;
    this.blocks.push(this.quote > 0 ? { kind: 'quote', text } : { kind: 'paragraph', text });
  }

  private endHeading(level: number): void {
    const text = lines(this.inline).replace(/\n/g, ' ');
    this.inline = '';
    if (text) this.blocks.push({ kind: 'heading', level, text });
  }

  private startPre(language: string): void {
    // Code in a table cell stays that cell's words, on one line: a table holds no code block.
    if (this.table) return;
    if (this.lists.length > 0) {
      // Code inside a list item: the list so far is one block, the code the next, kept exactly.
      this.commitItem();
      this.endListBlock();
    } else {
      this.flush();
    }
    this.pre = { language, text: '' };
  }

  private endPre(): void {
    const pre = this.pre!;
    this.pre = null;
    const code = pre.text
      .replace(/^\n/, '')
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/, ''))
      .join('\n')
      .replace(/\s+$/, '');
    if (code.trim()) this.blocks.push({ kind: 'code', language: pre.language, text: code });
  }

  private startList(ordered: boolean): void {
    if (this.lists.length === 0) this.flush();
    this.commitItem();
    this.lists.push({ ordered, next: 1 });
  }

  private endList(): void {
    this.commitItem();
    this.lists.pop();
    if (this.lists.length === 0) this.endListBlock();
  }

  /** The items gathered so far, as one list block. */
  private endListBlock(): void {
    const items = this.items
      .map((item) => ({ ...item, text: lines(item.text) }))
      .filter((item) => item.text);
    this.items = [];
    if (items.length > 0) this.blocks.push({ kind: 'list', items });
  }

  private startItem(): void {
    this.commitItem();
    const list = this.lists[this.lists.length - 1];
    this.item = {
      depth: Math.max(0, this.lists.length - 1),
      marker: list?.ordered ? `${list.next++}.` : '-',
      text: '',
    };
  }

  private commitItem(): void {
    const item = this.item;
    this.item = null;
    if (item && lines(item.text)) this.items.push(item);
  }

  private startTable(): void {
    if (this.table) {
      this.nestedTables += 1;
      return;
    }
    this.flush();
    this.table = { rows: [], row: null, cell: null, caption: '', captioning: false };
  }

  private endTable(): void {
    if (this.nestedTables > 0) {
      this.nestedTables -= 1;
      return;
    }
    const table = this.table;
    if (!table) return;
    this.commitRow();
    this.table = null;
    const caption = lines(table.caption).replace(/\n/g, ' ');
    if (caption) this.blocks.push({ kind: 'paragraph', text: caption });
    if (table.rows.length > 0) this.blocks.push({ kind: 'table', rows: table.rows });
  }

  private cell(closing: boolean): void {
    const table = this.table;
    if (!table || this.nestedTables > 0) return;
    if (table.cell !== null) {
      (table.row ??= []).push(cellText(table.cell));
      table.cell = null;
    }
    if (!closing) {
      table.row ??= [];
      table.cell = '';
    }
  }

  private commitRow(): void {
    const table = this.table;
    if (!table) return;
    if (table.cell !== null) {
      (table.row ??= []).push(cellText(table.cell));
      table.cell = null;
    }
    if (table.row && table.row.some((cell) => cell)) table.rows.push(table.row);
    table.row = null;
  }
}

/** Text with its line breaks kept, each line's spaces folded, and empty lines gone. */
function lines(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** A cell's words on one line, its pipes escaped so that they stay inside the cell. */
function cellText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
}

function languageOf(className: string): string {
  return /(?:^|\s)language-([a-z0-9+#-]+)/.exec(className)?.[1] ?? '';
}
