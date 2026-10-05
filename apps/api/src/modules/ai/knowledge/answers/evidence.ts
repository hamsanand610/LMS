import type { KnowledgeRetrievalResult } from '@lms/shared';
import { credentialsIn } from '../../policy/data-class.js';
import { FAKE_EMBEDDING_MODEL } from '../../providers/fake.provider.js';
import type { EvidencePassage } from './grounded-prompt.js';

/** A grounded answer's bounds (Phase 8E; ADR-0037). */
export const KNOWLEDGE_ANSWER_LIMITS = {
  /** Passages retrieved for an answer: more than it may use, so the floor and the checks can thin them. */
  retrieve: 8,
  /** Passages one answer may draw on. */
  passages: 6,
  /** Characters of evidence, all passages together: about 3,000 tokens. */
  evidenceCharacters: 12_000,
  /** The longest answer kept: anything longer is not the concise answer asked for. */
  answerCharacters: 4_000,
  /** Output tokens asked for, at most (AI_MAX_OUTPUT_TOKENS may lower it). */
  outputTokens: 1_024,
  /** How freely the model words its answer: low, so it keeps to its sources. */
  temperature: 0.2,
  /** Attempts at a grounded answer: the first, and one more after an answer that broke the rules. */
  attempts: 2,
  /** Grounded answers written at once by this process (one per person besides). */
  concurrent: 8,
} as const;

/**
 * The evidence floor measured for each embedding model: the least cosine similarity a passage needs
 * to be evidence (ADR-0037). Similarities are a model's own scale, so a floor is measured per
 * model, on the evaluation corpus (`test/fixtures/knowledge-answer-corpus.ts`), between the closest
 * passage of questions the knowledge base cannot answer and that of questions it can. For the
 * fake's vectors (4 October 2026): at most 0.298 for the eleven it cannot answer, at least 0.495 for
 * the eleven it can — the floor is the middle of that gap, 0.40, a tenth from either side. Gemini's
 * is not listed: it is measured once a key is configured, and set as AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY.
 */
export const KNOWLEDGE_EVIDENCE_FLOORS: Readonly<Record<string, number>> = {
  [FAKE_EMBEDDING_MODEL]: 0.4,
};

/**
 * The evidence floor for the active embedding model: the configured one (it is the deployment's
 * measurement), else the one measured here, else none — and with none, no grounded answer is
 * attempted, because nothing could tell evidence from noise.
 */
export function evidenceFloorFor(model: string | null, configured: number | null): number | null {
  if (configured !== null) return configured;
  if (model === null) return null;
  return KNOWLEDGE_EVIDENCE_FLOORS[model] ?? null;
}

/** A passage chosen as evidence, with its citation id. */
export interface PackedPassage extends EvidencePassage {
  result: KnowledgeRetrievalResult;
}

/** Why retrieved passages were not used: counts, for the audit entry. */
export interface Withheld {
  /** Less similar to the question than the floor: not evidence. */
  belowFloor: number;
  /** Of a data class the provider may not be given now. */
  unapproved: number;
  /** Holding a credential, which is never sent anywhere. */
  restricted: number;
  /** Past the evidence's size or number of passages. */
  overBudget: number;
}

export interface EvidencePolicy {
  floor: number;
  /** The data classes the provider may be given now (the router's, the institute's narrowing). */
  approved: readonly string[];
}

/**
 * The evidence for an answer, from what retrieval returned for the person — and nothing else: the
 * passages in retrieval's order (most similar first, then by chunk), each checked before it may be
 * sent: similar enough to be evidence, of a data class the provider may be given, holding no
 * credential, within the evidence's bounds. Each passage kept gets the next citation id, so the
 * same retrieval always gives the same evidence. Retrieval stays the authority on what the person
 * may draw on: this only ever removes.
 */
export function packEvidence(
  results: readonly KnowledgeRetrievalResult[],
  policy: EvidencePolicy,
): { packed: PackedPassage[]; withheld: Withheld; characters: number } {
  const withheld: Withheld = { belowFloor: 0, unapproved: 0, restricted: 0, overBudget: 0 };
  const packed: PackedPassage[] = [];
  let characters = 0;
  for (const result of results) {
    if (result.similarity < policy.floor) {
      withheld.belowFloor += 1;
      continue;
    }
    if (!policy.approved.includes(result.source.dataClass)) {
      withheld.unapproved += 1;
      continue;
    }
    const given = [result.source.name, result.document.title, result.heading, result.content];
    if (credentialsIn(given.join('\n')).length > 0) {
      withheld.restricted += 1;
      continue;
    }
    const size = result.content.length;
    if (
      packed.length >= KNOWLEDGE_ANSWER_LIMITS.passages ||
      characters + size > KNOWLEDGE_ANSWER_LIMITS.evidenceCharacters
    ) {
      withheld.overBudget += 1;
      continue;
    }
    characters += size;
    packed.push({
      id: `S${packed.length + 1}`,
      source: result.source.name,
      document: result.document.title,
      heading: result.heading,
      content: result.content,
      result,
    });
  }
  return { packed, withheld, characters };
}
