import { describe, expect, it } from 'vitest';
import { sameMimeFamily, sniffMime } from './sniff.js';

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);

describe('sniffMime', () => {
  it('recognises common image, icon and document signatures', () => {
    expect(sniffMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffMime(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe('image/gif');
    expect(sniffMime(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe(
      'image/webp',
    );
    expect(sniffMime(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe('application/pdf');
    expect(sniffMime(bytes(0x00, 0x00, 0x01, 0x00, 0x01))).toBe('image/x-icon');
  });

  it('recognises SVG from the text prologue and returns null for unknown content', () => {
    expect(
      sniffMime(
        new TextEncoder().encode(
          '  <?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>',
        ),
      ),
    ).toBe('image/svg+xml');
    expect(
      sniffMime(new TextEncoder().encode('<html><body>not an image</body></html>')),
    ).toBeNull();
    expect(sniffMime(bytes())).toBeNull();
  });
});

describe('sameMimeFamily', () => {
  it('treats the two icon spellings as one family', () => {
    expect(sameMimeFamily('image/x-icon', 'image/vnd.microsoft.icon')).toBe(true);
    expect(sameMimeFamily('image/png', 'image/jpeg')).toBe(false);
  });
});
