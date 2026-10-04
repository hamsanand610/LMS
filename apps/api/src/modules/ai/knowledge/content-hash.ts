import { createHash } from 'node:crypto';

/**
 * Knowledge text as the knowledge base keeps and compares it (Roadmap Phase 8A; ADR-0033): Unicode
 * NFC, `\n` line ends, no spaces at a line's end, no blank lines at either end. Differences of form
 * alone — a file saved on Windows, an editor's trailing spaces — make no new version; anything else,
 * blank lines inside the text included, is the text itself and is kept as it is.
 */
export function normaliseKnowledgeText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+$/, ''))
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
}

/** SHA-256 of the normalised text, in hex: the same content, in any form, has the same hash. */
export function knowledgeContentHash(text: string): string {
  return createHash('sha256').update(normaliseKnowledgeText(text), 'utf8').digest('hex');
}
