import { KnowledgeIngestionError } from './errors.js';

/** UTF-8, strictly: a byte sequence that is not UTF-8 makes the content malformed, never a guess. */
const UTF8 = new TextDecoder('utf-8', { fatal: true });

/**
 * Control characters other than tab and line ends, and the invisible characters that carry no
 * meaning: the zero-width space, the word joiner and the byte-order mark. The zero-width joiner and
 * non-joiner stay, because Indic scripts need them. None of these is half of a surrogate pair.
 */
function invisible(code: number): boolean {
  return (
    code <= 0x08 ||
    code === 0x0b ||
    code === 0x0c ||
    (code >= 0x0e && code <= 0x1f) ||
    code === 0x7f ||
    code === 0x200b ||
    code === 0x2060 ||
    code === 0xfeff
  );
}

/** A version's stored bytes as text (Phase 8B). */
export function decodeKnowledgeText(bytes: Uint8Array): string {
  try {
    return UTF8.decode(bytes);
  } catch {
    throw new KnowledgeIngestionError('malformed_content', 'The content is not valid UTF-8');
  }
}

/**
 * The one form every format's text takes before its structure is read (Phase 8B; ADR-0034):
 * Unicode NFC, LF line ends, no control or zero-width characters. Deterministic, and it removes
 * nothing that carries meaning: no lowercasing, no punctuation, no reflowed lines.
 */
export function normaliseSource(text: string): string {
  const normal = text.normalize('NFC').replace(/\r\n?/g, '\n');
  let kept = '';
  let from = 0;
  for (let at = 0; at < normal.length; at += 1) {
    if (invisible(normal.charCodeAt(at))) {
      kept += normal.slice(from, at);
      from = at + 1;
    }
  }
  return from === 0 ? normal : kept + normal.slice(from);
}
