import { describe, expect, it } from 'vitest';
import { sanitizeLessonHtml } from './sanitize.js';

describe('lesson HTML', () => {
  it('keeps the structure a lesson is written in', () => {
    const lesson =
      '<h2>Loops</h2><p>A <strong>for</strong> loop repeats.</p>' +
      '<pre class="language-java"><code class="language-java">for (int i = 0; i &lt; 3; i++) {}</code></pre>' +
      '<ul><li>one</li></ul><table><tr><td colspan="2">cell</td></tr></table>';
    const clean = sanitizeLessonHtml(lesson);
    expect(clean).toContain('<h2>Loops</h2>');
    expect(clean).toContain('<strong>for</strong>');
    expect(clean).toContain('<code class="language-java">');
    expect(clean).toContain('<td colspan="2">');
  });

  it('removes everything that can run or restyle the page', () => {
    const attacks = [
      '<script>alert(1)</script>',
      '<img src="x" onerror="alert(1)">',
      '<a href="javascript:alert(1)">open</a>',
      '<iframe src="https://example.com"></iframe>',
      '<p style="position:fixed;inset:0">cover</p>',
      '<svg><script>alert(1)</script></svg>',
      '<form action="https://example.com"><input name="password"></form>',
      '<a href="//example.com/login">protocol-relative</a>',
      '<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=">',
      '<p class="fixed inset-0 z-50">class hooks</p>',
    ];
    for (const attack of attacks) {
      const clean = sanitizeLessonHtml(attack);
      expect(clean, attack).not.toMatch(
        /<script|onerror|javascript:|<iframe|style=|<svg|<form|<input|href="\/\/|data:|class="fixed/i,
      );
    }
  });

  it('protects the window a new-tab link opens from', () => {
    expect(sanitizeLessonHtml('<a href="https://docs.oracle.com" target="_blank">docs</a>')).toBe(
      '<a href="https://docs.oracle.com" target="_blank" rel="noopener noreferrer">docs</a>',
    );
    expect(sanitizeLessonHtml('<a href="https://docs.oracle.com" target="_top">docs</a>')).toBe(
      '<a href="https://docs.oracle.com">docs</a>',
    );
  });
});
