import { describe, expect, it } from 'vitest';
import { canonicalMime, contentMatches, sameMimeFamily, sniffMime } from './sniff.js';

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

describe('contentMatches', () => {
  it('refuses a typed file whose content cannot be recognised', () => {
    expect(contentMatches('application/pdf', null)).toBe(false);
    expect(contentMatches('image/png', null)).toBe(false);
    expect(contentMatches('application/pdf', 'application/pdf')).toBe(true);
    expect(contentMatches('image/png', 'image/jpeg')).toBe(false);
  });

  it('accepts plain text, which has no signature, and office documents as ZIP', () => {
    expect(contentMatches('text/csv', null)).toBe(true);
    expect(contentMatches('text/plain', null)).toBe(true);
    expect(
      contentMatches(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sniffMime(bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00)),
      ),
    ).toBe(true);
  });

  it('recognises the video containers lessons use', () => {
    expect(sniffMime(bytes(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d))).toBe(
      'video/mp4',
    );
    expect(sniffMime(bytes(0x1a, 0x45, 0xdf, 0xa3, 0x01))).toBe('video/webm');
  });
});

describe('canonicalMime', () => {
  it('maps the names browsers use to the ones the contexts list', () => {
    expect(canonicalMime('application/x-zip-compressed', 'starter.zip')).toBe('application/zip');
    expect(canonicalMime('image/JPG', 'photo.jpg')).toBe('image/jpeg');
    expect(canonicalMime('application/vnd.ms-excel', 'marks.csv')).toBe('text/csv');
    // Only a CSV by name is read as one; a real Excel file keeps its type (and is refused).
    expect(canonicalMime('application/vnd.ms-excel', 'marks.xls')).toBe('application/vnd.ms-excel');
    expect(canonicalMime('application/pdf', 'notes.pdf')).toBe('application/pdf');
  });
});

describe('sameMimeFamily', () => {
  it('treats the two icon spellings as one family', () => {
    expect(sameMimeFamily('image/x-icon', 'image/vnd.microsoft.icon')).toBe(true);
    expect(sameMimeFamily('image/png', 'image/jpeg')).toBe(false);
  });
});
