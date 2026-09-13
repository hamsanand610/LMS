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
  const text = new TextDecoder('utf-8', { fatal: false })
    .decode(b.subarray(0, Math.min(b.length, 512)))
    .trimStart();
  if (text.startsWith('<') && /<svg[\s>]/i.test(text)) return 'image/svg+xml';
  return null;
}

/** Icons come with two MIME spellings; treat them as one family. */
export function sameMimeFamily(a: string, b: string): boolean {
  const norm = (m: string) => (m === 'image/vnd.microsoft.icon' ? 'image/x-icon' : m);
  return norm(a) === norm(b);
}
