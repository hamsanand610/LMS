# ADR-0027 — Embeddings belong to Phase 8

- **Status**: accepted (decided in the client's Phase 7A brief, 3 October 2026)
- **Date**: 2026-10-03
- **Phase**: Roadmap Phase 7 (AI foundation), slice 7A
- **Implements**: `docs/architecture/AI_ARCHITECTURE.md` §9, decision 4

## Context

Retrieval and the semantic answer cache will compare texts by embeddings. Choosing an embedding
model fixes a vector dimension, a cost and a data path to a provider, and changing it later means
embedding everything again.

## Decision

1. Embeddings belong to **Phase 8**. Phase 7 has no embedding model, dimension, table or job.
2. The provider interface reserves `embed()`. Every Phase 7 provider refuses it as unavailable.
3. Before implementation, verify and record:
   - the dimension against pgvector's index limits (an HNSW index on `vector` accepts at most 2,000
     dimensions);
   - the provider's data terms for the texts sent (ADR-0024);
   - cost;
   - a re-embedding path, with the model and dimension stored beside every vector.

## Alternatives

- Choosing a model now: a decision with no consumer, made before any evaluation.

## Consequences

- The semantic cache's Phase 7 foundation matches normalised questions exactly. Similarity matching
  arrives with embeddings in Phase 8. The Phase 7 cache is ADR-0032 (Phase 7D).
