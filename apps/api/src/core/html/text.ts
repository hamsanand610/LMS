/** Entities the lesson editor and authors write; anything else numeric is decoded by number. */
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
};

/** A character by its code point, or the entity as written when it names none. */
function character(codePoint: number, written: string): string {
  return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : written;
}

/**
 * Character references decoded: the named ones the lesson editor and authors write, and any by
 * number. One a reader would not know stays as written (Phase 7E; the knowledge base's HTML reader,
 * Phase 8B).
 */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      return character(Number.parseInt(entity.slice(2), 16), match);
    }
    if (entity.startsWith('#')) return character(Number(entity.slice(1)), match);
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/**
 * The words of an HTML fragment as plain text (Phase 7E: what SI Academy AI is given of a lesson).
 * Scripts and styles go entirely; block ends become line breaks; tags go; entities are decoded;
 * runs of spaces and blank lines are folded. The result is for reading, never for rendering.
 */
export function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|pre|blockquote|tr|section|article)>/gi, '\n')
      .replace(/<[^>]*>/g, ' '),
  )
    .replace(/[ \t\f\v\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
