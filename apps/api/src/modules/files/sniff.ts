/** Detects the real type of an upload from its first bytes. Returns null when unknown. */
export function sniffMime(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38)
    return 'image/gif';
  if (
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return 'image/webp';
  if (b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46)
    return 'application/pdf';
  if (b.length >= 4 && b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00)
    return 'image/x-icon';
  // ZIP, which is also what .docx, .pptx and .xlsx files are.
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04)
    return 'application/zip';
  // ISO base media: an "ftyp" box straight after the first box size.
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70)
    return 'video/mp4';
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3)
    return 'video/webm';
  const text = new TextDecoder('utf-8', { fatal: false })
    .decode(b.subarray(0, Math.min(b.length, 512)))
    .trimStart();
  if (text.startsWith('<') && /<svg[\s>]/i.test(text)) return 'image/svg+xml';
  return null;
}

/** Office documents are ZIP containers, and icons come with two MIME spellings. */
const FAMILY: Record<string, string> = {
  'image/vnd.microsoft.icon': 'image/x-icon',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'application/zip',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'application/zip',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'application/zip',
};

export function sameMimeFamily(a: string, b: string): boolean {
  const norm = (m: string) => FAMILY[m] ?? m;
  return norm(a) === norm(b);
}

/** Other names browsers give the same format; Windows reports a ZIP as `x-zip-compressed`. */
const MIME_ALIASES: Record<string, string> = {
  'application/x-zip-compressed': 'application/zip',
  'application/x-zip': 'application/zip',
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
};

/**
 * The declared type under the name the upload contexts list. Only a claim either way: the bytes
 * are checked against it when the upload completes.
 */
export function canonicalMime(mime: string, filename: string): string {
  const lower = mime.trim().toLowerCase();
  const alias = MIME_ALIASES[lower];
  if (alias) return alias;
  // Windows with Excel installed reports every .csv as an Excel sheet.
  if (lower === 'application/vnd.ms-excel' && /\.csv$/i.test(filename)) return 'text/csv';
  return lower;
}

/** Plain-text types have no signature to check; every other accepted type has one. */
const WITHOUT_SIGNATURE = new Set(['text/plain', 'text/csv']);

/**
 * Whether an upload's first bytes prove it is what it was declared to be. A type that has a
 * signature must show it: content that cannot be recognised is refused, not waved through.
 */
export function contentMatches(declared: string, sniffed: string | null): boolean {
  if (sniffed === null) return WITHOUT_SIGNATURE.has(declared);
  return sameMimeFamily(sniffed, declared);
}
