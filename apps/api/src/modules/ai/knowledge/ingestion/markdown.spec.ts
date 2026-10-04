import { describe, expect, it } from 'vitest';
import { parseMarkdown, parsePlainText } from './markdown.js';

describe('the Markdown reader (Phase 8B)', () => {
  it('reads headings, paragraphs, lists, code, tables and quotations', () => {
    const source = [
      '# Title',
      '',
      'First line of a paragraph',
      'and its second line.',
      '',
      'Setext heading',
      '--------------',
      '',
      '- one',
      '- two',
      '  - nested',
      '3) three',
      '',
      '```java',
      'int x = 1;',
      '',
      '  return x;',
      '```',
      '',
      '| Name | Note |',
      '| --- | :---: |',
      '| a | uses \\| pipe |',
      '',
      '> Quoted words',
      '> go on.',
      '',
      '***',
      '',
      '    indented code',
      '    stays code',
    ].join('\n');
    expect(parseMarkdown(source)).toEqual([
      { kind: 'heading', level: 1, text: 'Title' },
      { kind: 'paragraph', text: 'First line of a paragraph\nand its second line.' },
      { kind: 'heading', level: 2, text: 'Setext heading' },
      {
        kind: 'list',
        items: [
          { depth: 0, marker: '-', text: 'one' },
          { depth: 0, marker: '-', text: 'two' },
          { depth: 1, marker: '-', text: 'nested' },
          { depth: 0, marker: '3.', text: 'three' },
        ],
      },
      { kind: 'code', language: 'java', text: 'int x = 1;\n\n  return x;' },
      {
        kind: 'table',
        rows: [
          ['Name', 'Note'],
          ['a', 'uses \\| pipe'],
        ],
      },
      { kind: 'quote', text: 'Quoted words\ngo on.' },
      { kind: 'code', language: '', text: 'indented code\nstays code' },
    ]);
  });

  it('keeps Markdown as written: HTML inside it stays text, and an unclosed fence runs to the end', () => {
    expect(parseMarkdown('Use `<script>` and <style> tags to say so.')).toEqual([
      { kind: 'paragraph', text: 'Use `<script>` and <style> tags to say so.' },
    ]);
    expect(parseMarkdown('Before.\n\n```js\nlet a = 1;\n\nlet b = 2;')).toEqual([
      { kind: 'paragraph', text: 'Before.' },
      { kind: 'code', language: 'js', text: 'let a = 1;\n\nlet b = 2;' },
    ]);
  });

  it('lets only a bullet or a list from 1 begin inside a paragraph', () => {
    expect(parseMarkdown('In the year\n2019. was busy')).toEqual([
      { kind: 'paragraph', text: 'In the year\n2019. was busy' },
    ]);
    expect(parseMarkdown('Steps:\n1. first\n2. second')).toEqual([
      { kind: 'paragraph', text: 'Steps:' },
      {
        kind: 'list',
        items: [
          { depth: 0, marker: '1.', text: 'first' },
          { depth: 0, marker: '2.', text: 'second' },
        ],
      },
    ]);
  });

  it('keeps a list item’s further lines and paragraphs with it', () => {
    expect(
      parseMarkdown('- first item\n  goes on here\n\n  and has a second paragraph\n- next'),
    ).toEqual([
      {
        kind: 'list',
        items: [
          { depth: 0, marker: '-', text: 'first item\ngoes on here\n\nand has a second paragraph' },
          { depth: 0, marker: '-', text: 'next' },
        ],
      },
    ]);
  });

  it('reads plain text as paragraphs, every line as written', () => {
    expect(parsePlainText('  indented line\nsecond line   \n\n\n\nnext paragraph\n')).toEqual([
      { kind: 'paragraph', text: '  indented line\nsecond line' },
      { kind: 'paragraph', text: 'next paragraph' },
    ]);
    expect(parsePlainText('  \n\t\n')).toEqual([]);
  });
});
