import { describe, expect, it } from 'vitest';
import { htmlToText } from './text.js';

describe('the words of an HTML fragment (Phase 7E)', () => {
  it('keeps the words and the paragraph breaks, and nothing of the markup', () => {
    expect(
      htmlToText(
        '<h2>Loops</h2><p>A <strong>for</strong> loop repeats.</p><ul><li>One</li><li>Two</li></ul>',
      ),
    ).toBe('Loops\nA for loop repeats.\nOne\nTwo');
  });

  it('drops scripts and styles entirely, and decodes entities', () => {
    expect(
      htmlToText(
        '<style>p{color:red}</style><p>a &lt; b &amp;&amp; c &#62; d&nbsp;e &#x41;</p><script>alert(1)</script>',
      ),
    ).toBe('a < b && c > d e A');
  });

  it('leaves an entity that names no character as it was written, rather than failing', () => {
    expect(htmlToText('<p>&#99999999; &#x110000; &bogus;</p>')).toBe(
      '&#99999999; &#x110000; &bogus;',
    );
  });

  it('folds runs of spaces and blank lines', () => {
    expect(htmlToText('<p>one   two</p>\n\n\n<p>three</p><br><br><br>')).toBe('one two\n\nthree');
  });
});
