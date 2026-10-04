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

/** The namespace of chunk identities (RFC 4122 name-based UUIDs); fixed for good. */
const CHUNK_NAMESPACE = Buffer.from('6e8eaf7476c6465ba6a2cf181d681e1e', 'hex');

/**
 * A chunk's identity, from what it is (Phase 8B; ADR-0034): its version, its place in it and its
 * content's hash, as a name-based UUID (version 5). Ingesting the same version again gives the same
 * chunks the same ids, so an embedding keyed by a chunk (Phase 8C) stays valid while the chunk does.
 */
export function knowledgeChunkId(versionId: string, position: number, contentHash: string): string {
  const hash = createHash('sha1')
    .update(CHUNK_NAMESPACE)
    .update(`${versionId}:${position}:${contentHash}`, 'utf8')
    .digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
