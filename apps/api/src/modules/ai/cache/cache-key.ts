import { createHash } from 'node:crypto';
import type { AiPurpose } from '@lms/shared';
import { NORMALISATION_VERSION } from './normalize.js';

/**
 * What an answer knew besides its question. Phase 7 answers draw on no knowledge source, so every
 * entry carries this; Phase 8 sets a version from the sources an answer was built from.
 */
export const AI_CACHE_KNOWLEDGE_VERSION = 'none';

export type AiCacheScopeName = 'shared' | 'user';

/** Everything two questions must share for one's answer to serve the other (ADR-0032). */
export interface AiCacheKeyParts {
  organizationId: string;
  scope: AiCacheScopeName;
  /** The person a `user` entry is for; never set for a `shared` one. */
  userId: string | null;
  purpose: AiPurpose;
  dataClass: string;
  language: string;
  modelFamily: string;
  promptVersion: string;
  knowledgeVersion: string;
  /** The normalised question (`normaliseQuestion`). */
  question: string;
}

/**
 * The key an answer is kept under: SHA-256 of every part, in a fixed order, with the version of
 * the normalisation. A part that differs is another key: another institute, scope, person, surface,
 * data class, language, model family, prompt version, knowledge version or question.
 */
export function cacheKeyHash(parts: AiCacheKeyParts): string {
  if ((parts.scope === 'user') !== (parts.userId !== null)) {
    throw new Error('A user entry names its person, and a shared entry names nobody');
  }
  const canonical = JSON.stringify([
    NORMALISATION_VERSION,
    parts.organizationId,
    parts.scope,
    parts.userId,
    parts.purpose,
    parts.dataClass,
    parts.language,
    parts.modelFamily,
    parts.promptVersion,
    parts.knowledgeVersion,
    parts.question,
  ]);
  return createHash('sha256').update(canonical).digest('hex');
}
