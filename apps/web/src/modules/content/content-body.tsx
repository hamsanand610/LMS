import { Fragment } from 'react';
import { cn } from '@/lib/utils';

/**
 * The words of one of the institute's own pages (privacy, terms, anything else), written as plain
 * text with a few marks: a blank line starts a paragraph; `## ` and `### ` start headings; lines
 * that start with `- ` make a list; `**words**` are bold; `[To be confirmed: …]` is set apart, so a
 * reader sees at once what is still being settled. Rendered as React text only — nothing in a
 * page is ever interpreted as HTML.
 */
export type ContentBlock =
  | { kind: 'heading'; level: 2 | 3; text: string; id: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'paragraph'; text: string };

/** The anchor a heading gets: its words, lower-cased and hyphenated. */
export function anchorOf(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/\*\*/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'section'
  );
}

export function blocksOf(body: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const used = new Map<string, number>();
  const idFor = (text: string) => {
    const base = anchorOf(text);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    return seen === 0 ? base : `${base}-${seen + 1}`;
  };
  let paragraph: string[] = [];
  let list: string[] | null = null;
  const flush = () => {
    if (paragraph.length > 0) blocks.push({ kind: 'paragraph', text: paragraph.join('\n') });
    if (list) blocks.push({ kind: 'list', items: list });
    paragraph = [];
    list = null;
  };
  for (const raw of body.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      const text = heading[2]!.trim();
      blocks.push({ kind: 'heading', level: heading[1]!.length as 2 | 3, text, id: idFor(text) });
    } else if (/^\s*-\s+/.test(line)) {
      if (paragraph.length > 0) flush();
      list ??= [];
      list.push(line.replace(/^\s*-\s+/, ''));
    } else if (line.trim() === '') {
      flush();
    } else if (list && /^\s{2,}\S/.test(raw)) {
      // An indented line carries on the list item above it.
      list[list.length - 1] += ` ${line.trim()}`;
    } else {
      if (list) flush();
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

/** `**bold**` and `[To be confirmed: …]` within a line; everything else is text. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|\[To be confirmed[^\]]*\])/).map((chunk, index) => {
        if (chunk.startsWith('**') && chunk.endsWith('**') && chunk.length > 4) {
          return (
            <strong key={index} className="font-semibold text-foreground">
              {chunk.slice(2, -2)}
            </strong>
          );
        }
        if (chunk.startsWith('[To be confirmed')) {
          return (
            <mark
              key={index}
              className="rounded bg-warning-soft px-1 py-0.5 text-[0.95em] text-foreground"
            >
              {chunk}
            </mark>
          );
        }
        return <Fragment key={index}>{chunk}</Fragment>;
      })}
    </>
  );
}

export function ContentBody({ body, className }: { body: string; className?: string }) {
  const blocks = blocksOf(body);
  const sections = blocks.filter(
    (block): block is Extract<ContentBlock, { kind: 'heading' }> =>
      block.kind === 'heading' && block.level === 2,
  );
  return (
    <div className={cn('text-[15px] leading-7 text-foreground-secondary', className)}>
      {sections.length >= 3 ? (
        <nav
          aria-label="On this page"
          className="mb-10 rounded-xl border border-border bg-surface-2/50 px-5 py-4"
        >
          <p className="eyebrow mb-2">On this page</p>
          <ol className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {sections.map((section) => (
              <li key={section.id} className="min-w-0">
                <a
                  href={`#${section.id}`}
                  className="block truncate rounded-sm text-brand underline-offset-4 hover:underline"
                >
                  {section.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="space-y-4">
        {blocks.map((block, index) => {
          if (block.kind === 'heading') {
            return block.level === 2 ? (
              <h2
                key={index}
                id={block.id}
                className="scroll-mt-6 pt-6 text-xl font-semibold tracking-[-0.01em] text-balance text-foreground"
              >
                {block.text}
              </h2>
            ) : (
              <h3
                key={index}
                id={block.id}
                className="scroll-mt-6 pt-2 text-base font-semibold text-foreground"
              >
                {block.text}
              </h3>
            );
          }
          if (block.kind === 'list') {
            return (
              <ul key={index} className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground">
                {block.items.map((item, i) => (
                  <li key={i}>
                    <Inline text={item} />
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p key={index} className="break-words whitespace-pre-line">
              <Inline text={block.text} />
            </p>
          );
        })}
      </div>
    </div>
  );
}
