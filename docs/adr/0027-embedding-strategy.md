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
- How the dimension is chosen, and the index it must fit, are settled in ADR-0026's readiness
  record (Phase 7F); the model itself is still chosen in Phase 8, under item 3.

## Phase 8A decision point (4 October 2026)

Phase 8A fixes no model or dimension. The choice depends on the Gemini API as it is when Phase 8C
starts, so 8A records what the documentation says now and what the choice must satisfy.

**What Gemini documents.** Google's embeddings page (last updated 17 September 2026, read on 4
October 2026) lists two stable models:

- `gemini-embedding-2`: multimodal, up to 8,192 input tokens per text; 3,072 dimensions by default,
  768 and 1,536 recommended as reduced sizes, which the service normalises; the task is stated in
  the text;
- `gemini-embedding-001`: text only, up to 2,048 input tokens per text; 3,072 dimensions by
  default, 768 and 1,536 recommended; reduced vectors must be normalised by the caller; the task
  (`RETRIEVAL_DOCUMENT`, `RETRIEVAL_QUERY` and others) is a parameter.

**What follows.**

1. Both defaults are above the 2,000 dimensions an HNSW index on `vector` accepts (ADR-0026, item
   4). Phase 8C embeds at a reduced size, 768 or 1,536, as `vector(n)`, or keeps 3,072 as
   `halfvec(3072)`.
2. Phase 8C chooses the model and the size from an evaluation on SI Academy's own test material,
   the data terms for institute material (ADR-0024: a paid tier before real data), the cost, and
   the chunk size of 8B, which must fit the model's input limit (each chunk keeps a token estimate
   for this).
3. Cosine distance does not depend on a vector's length. If 8C chooses inner product, every vector
   is stored at unit length.
4. The model's name and the dimension are stored beside every vector. Vectors of two models are
   never compared: a change embeds everything again (the re-embedding path of decision 3).
5. Before 8C embeds anything, the documentation is read again and the model's availability and
   terms are checked. Nothing in 8A depends on this choice.
