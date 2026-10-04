import { type AiProviderName, KNOWLEDGE_EMBEDDING_VERSION } from '@lms/shared';
import type { ModelRouter } from '../../routing/model-router.js';

/**
 * The embedding contract (Phase 8C; ADR-0035): the provider, model, dimension and the platform's
 * embedding version that new embeddings are made under — and the only ones retrieval may draw on.
 * A vector made under any other contract is never compared with these, and is never active.
 */
export interface KnowledgeEmbeddingContract {
  provider: Exclude<AiProviderName, 'none'>;
  model: string;
  dimension: number;
  embeddingVersion: string;
}

/** The active contract, from the router's embedding routing; none while the AI cannot embed. */
export function activeEmbeddingContract(router: ModelRouter): KnowledgeEmbeddingContract | null {
  const routing = router.embeddingRouting();
  if (!routing) return null;
  return {
    provider: routing.model.provider,
    model: routing.model.id,
    dimension: routing.dimension,
    embeddingVersion: KNOWLEDGE_EMBEDDING_VERSION,
  };
}

/** The columns that name a contract, as a Prisma filter. */
export function contractWhere(contract: KnowledgeEmbeddingContract) {
  return {
    provider: contract.provider,
    model: contract.model,
    dimension: contract.dimension,
    embeddingVersion: contract.embeddingVersion,
  };
}
