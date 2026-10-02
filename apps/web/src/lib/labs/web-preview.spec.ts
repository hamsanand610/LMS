// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  buildPreviewDocument,
  PREVIEW_CSP,
  PREVIEW_SOURCE,
  readPreviewMessage,
} from './web-preview';

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

/** The scripts a browser would run in the preview, in order. */
const runnable = (doc: Document) =>
  Array.from(doc.querySelectorAll('script')).filter(
    (s) => !s.hasAttribute('src') && ['', 'module', 'text/javascript'].includes(s.type),
  );

describe('the Web Lab preview document', () => {
  it('starts with its own policy and the console bridge, before anything of the page', () => {
    const doc = parse(
      buildPreviewDocument({ html: '<head><style>p{}</style></head><p>hi</p>', css: '', js: '' }),
    );
    const [policy, bridge] = Array.from(doc.head.children);
    expect(policy?.getAttribute('http-equiv')).toBe('Content-Security-Policy');
    expect(policy?.getAttribute('content')).toBe(PREVIEW_CSP);
    expect(bridge?.localName).toBe('script');
    expect(bridge?.textContent).toContain(PREVIEW_SOURCE);
    expect(PREVIEW_CSP).toContain("default-src 'none'");
    expect(PREVIEW_CSP).toContain("form-action 'none'");
    expect(PREVIEW_CSP).not.toMatch(/connect-src|https?:|'self'/);
  });

  it('fetches nothing: <base>, refresh and scripts with a src are removed', () => {
    const doc = parse(
      buildPreviewDocument({
        html: `<head><base href="https://evil.example/"><meta http-equiv="refresh" content="0;url=/api">
          <meta http-equiv="X-UA-Compatible" content="IE=edge"></head>
          <body><script src="https://evil.example/x.js"></script><script src="/api/v1/me"></script></body>`,
        css: '',
        js: '',
      }),
    );
    expect(doc.querySelector('base')).toBeNull();
    expect(doc.querySelector('meta[http-equiv="refresh"]')).toBeNull();
    expect(doc.querySelector('meta[http-equiv="X-UA-Compatible"]')).not.toBeNull();
    expect(doc.querySelector('script[src]')).toBeNull();
  });

  it('runs the page’s inline scripts at the end of the body, in order, then script.js', () => {
    const doc = parse(
      buildPreviewDocument({
        html: `<head><script>window.a = 1;</script></head><body><p id="x"></p>
          <script type="text/template"><li>kept as data</li></script><script>window.b = 2;</script></body>`,
        css: 'p { color: red; }',
        js: 'window.c = 3;',
      }),
    );
    const scripts = runnable(doc).map((s) => s.textContent);
    expect(scripts.slice(1)).toEqual(['window.a = 1;', 'window.b = 2;', 'window.c = 3;']);
    // Every runnable script but the bridge sits at the end of the body, after the page.
    for (const script of runnable(doc).slice(1)) expect(script.parentElement).toBe(doc.body);
    expect(doc.body.lastElementChild?.textContent).toBe('window.c = 3;');
    expect(doc.querySelector('script[type="text/template"]')?.textContent).toContain(
      'kept as data',
    );
    expect(doc.head.lastElementChild?.localName).toBe('style');
    expect(doc.head.lastElementChild?.textContent).toBe('p { color: red; }');
  });

  it('keeps a script or style from being closed early by its own text', () => {
    const html = buildPreviewDocument({
      html: '<p>x</p>',
      css: 'p::after { content: "</style><img src=x>"; }',
      js: "console.log('</script><img src=x onerror=alert(1)>');",
    });
    const doc = parse(html);
    expect(doc.querySelector('img')).toBeNull();
    expect(runnable(doc).at(-1)?.textContent).toContain("'<\\/script><img");
  });

  it('accepts only well-formed messages from a preview, and cuts long ones', () => {
    expect(readPreviewMessage({ source: PREVIEW_SOURCE, level: 'log', text: 'hi' })).toEqual({
      source: PREVIEW_SOURCE,
      level: 'log',
      text: 'hi',
    });
    expect(readPreviewMessage({ source: 'other', level: 'log', text: 'hi' })).toBeNull();
    expect(readPreviewMessage({ source: PREVIEW_SOURCE, level: 'eval', text: 'hi' })).toBeNull();
    expect(readPreviewMessage({ source: PREVIEW_SOURCE, level: 'log', text: 1 })).toBeNull();
    expect(readPreviewMessage('pass')).toBeNull();
    expect(
      readPreviewMessage({ source: PREVIEW_SOURCE, level: 'error', text: 'x'.repeat(5000) })?.text,
    ).toHaveLength(2000);
  });
});

/** A small seeded generator, so a failing case can be replayed from its seed. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const PIECES = [
  '<p>text</p>',
  '<div id="a"><span>nested</span></div>',
  '<script>window.n = (window.n || 0) + 1;</script>',
  '<script src="https://evil.example/x.js"></script>',
  '<script type="module">window.m = 1;</script>',
  '<script type="application/json">{"a":1}</script>',
  '<base href="https://evil.example/">',
  '<meta http-equiv="refresh" content="0;url=https://evil.example/">',
  '<meta http-equiv="Content-Security-Policy" content="default-src *">',
  '<style>p { color: blue; }</style>',
  '<form action="https://evil.example/"><input name="q"></form>',
  '<iframe src="https://evil.example/"></iframe>',
  '<img src="https://evil.example/beacon.png">',
  '</script></style><!-- -->',
  '<table><tr><td>cell</td></tr></table>',
  'loose text & < >',
];

describe('every preview document, whatever the page', () => {
  it('keeps the same guarantees for 300 generated pages', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const next = random(seed);
      const pick = () => PIECES[Math.floor(next() * PIECES.length)]!;
      const html = Array.from({ length: 1 + Math.floor(next() * 8) }, pick).join('\n');
      const js = next() < 0.5 ? '' : `console.log("${pick().replace(/"/g, "'")}");`;
      const css = next() < 0.5 ? '' : 'body { margin: 0; }';
      const out = buildPreviewDocument({ html, css, js });
      const doc = parse(out);
      const context = `seed ${seed}`;

      expect(out.startsWith('<!DOCTYPE html>'), context).toBe(true);
      // Our policy is the first thing in <head>, so it governs everything after it.
      expect(doc.head.firstElementChild?.getAttribute('content'), context).toBe(PREVIEW_CSP);
      expect(doc.querySelector('base'), context).toBeNull();
      expect(doc.querySelector('meta[http-equiv="refresh" i]'), context).toBeNull();
      expect(doc.querySelector('script[src]'), context).toBeNull();
      // Inline scripts: the bridge, the page's own (data blocks excluded) and script.js.
      const pageScripts = (html.match(/<script>|<script type="module">/g) ?? []).length;
      const scripts = runnable(doc);
      expect(scripts, context).toHaveLength(1 + pageScripts + (js ? 1 : 0));
      expect(scripts[0]?.textContent, context).toContain(PREVIEW_SOURCE);
      // The page's scripts close the body, so they run once its content is there.
      const count = scripts.length - 1;
      const tail = count > 0 ? Array.from(doc.body.children).slice(-count) : [];
      expect(
        tail.every((element) => element.localName === 'script'),
        context,
      ).toBe(true);
    }
  }, 60_000); // Parsing 600 documents takes longer when other suites run beside it.
});
