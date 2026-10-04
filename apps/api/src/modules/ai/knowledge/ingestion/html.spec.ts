import { describe, expect, it } from 'vitest';
import { renderBlock } from './blocks.js';
import { parseHtml } from './html.js';

const NBSP = String.fromCharCode(0xa0);

describe('the HTML reader (Phase 8B)', () => {
  it('keeps the structure and the words, and nothing only a browser would show', () => {
    const page = [
      '<!doctype html><html><head><title>Page title</title><style>p { color: red; }</style></head>',
      '<body><nav>Home | Sign in</nav><script>steal(document.cookie)</script>',
      '<h1 class="big" onclick="x()">Loops &amp; Iteration</h1>',
      '<p>A <strong>loop</strong> repeats work; <code>for</code> counts.<br>A second line.</p>',
      '<ol><li>Read</li><li>Try<ul><li>Change a value</li></ul></li></ol>',
      '<pre><code class="language-java">for (int i = 0; i &lt; 3; i++) {\n    sum += i;\n}</code></pre>',
      '<table><caption>Marks</caption><tr><th>Topic</th><th>Note</th></tr>',
      '<tr><td>loops</td><td>a | b</td></tr></table>',
      '<blockquote><p>Practise daily.</p></blockquote>',
      '<img src="x.png" alt="diagram"><iframe src="https://e.x"></iframe>',
      '<footer>Copyright</footer><!-- a comment --></body></html>',
    ].join('\n');
    expect(parseHtml(page)).toEqual([
      { kind: 'heading', level: 1, text: 'Loops & Iteration' },
      { kind: 'paragraph', text: 'A loop repeats work; `for` counts.\nA second line.' },
      {
        kind: 'list',
        items: [
          { depth: 0, marker: '1.', text: 'Read' },
          { depth: 0, marker: '2.', text: 'Try' },
          { depth: 1, marker: '-', text: 'Change a value' },
        ],
      },
      { kind: 'code', language: 'java', text: 'for (int i = 0; i < 3; i++) {\n    sum += i;\n}' },
      { kind: 'paragraph', text: 'Marks' },
      {
        kind: 'table',
        rows: [
          ['Topic', 'Note'],
          ['loops', 'a \\| b'],
        ],
      },
      { kind: 'quote', text: 'Practise daily.' },
    ]);
    const text = parseHtml(page).map(renderBlock).join('\n');
    for (const gone of [
      'Page title',
      'color',
      'Sign in',
      'steal',
      'diagram',
      'Copyright',
      'comment',
    ]) {
      expect(text).not.toContain(gone);
    }
  });

  it('decodes entities and folds whitespace, non-breaking spaces too', () => {
    const e = String.fromCharCode(0xe9);
    expect(
      parseHtml(`<p>a&nbsp;&nbsp;b ${NBSP} c &amp; &lt;d&gt; &#233;t&#xe9;\n   e</p>`),
    ).toEqual([{ kind: 'paragraph', text: `a b c & <d> ${e}t${e} e` }]);
  });

  it('keeps code inside a list item exactly, between the parts of the list', () => {
    expect(
      parseHtml('<ul><li>Before<pre>  indented\n    more</pre>after</li><li>Next</li></ul>'),
    ).toEqual([
      { kind: 'list', items: [{ depth: 0, marker: '-', text: 'Before' }] },
      { kind: 'code', language: '', text: '  indented\n    more' },
      {
        kind: 'list',
        items: [
          { depth: 0, marker: '-', text: 'after' },
          { depth: 0, marker: '-', text: 'Next' },
        ],
      },
    ]);
  });

  it('reads broken HTML without losing its words', () => {
    const blocks = parseHtml(
      '<p>unclosed <b>bold<div>inside</div><li>stray item<table><tr><td>a<table><tr><td>inner</td></tr></table>b</td></tr></table>',
    );
    const text = blocks.map(renderBlock).join('\n');
    for (const word of ['unclosed', 'bold', 'inside', 'stray item', 'inner']) {
      expect(text).toContain(word);
    }
  });

  it('has nothing to give for scripts and styles alone', () => {
    expect(parseHtml('<script>a()</script><style>b{}</style><noscript>c</noscript>')).toEqual([]);
  });
});
