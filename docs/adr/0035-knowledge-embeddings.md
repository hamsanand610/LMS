# ADR-0035 — Knowledge embeddings and pgvector

- **Status**: proposed (built in Roadmap Phase 8C on 4 October 2026); accepted when the client
  approves slice 8C
- **Date**: 2026-10-04
- **Phase**: Roadmap Phase 8 (RAG knowledge system), slice 8C
- **Builds on**: ADR-0026 (vector storage: the pgvector image, the type and the index), ADR-0027
  (embeddings: the decision point this ADR closes), ADR-0033 (the knowledge base and its reach
  rule), ADR-0034 (ingestion and chunking: the chunks and hashes embedded here), ADR-0024 (providers
  and data classes), ADR-0025 (the model router), ADR-0029 (usage, quotas and budgets), ADR-0006
  (jobs)

## Context

Phase 8B turns a version's content into chunks with deterministic ids and hashes. Phase 8D will
search them by meaning, which needs one vector per chunk, made by one model at one size, kept in
PostgreSQL beside the chunks so that the reach rule (ADR-0033) filters in the same query. ADR-0027
left the model and the dimension to this slice, to be chosen from Google's documentation as it
stands, not from memory; ADR-0026 settled pgvector on the platform's own Alpine image.

What makes this hard is not calling a model: it is never keeping a vector that no longer matches
its chunk, its model or its size, never embedding what may not be drawn on, never letting a key
out, and never letting a retry or a second worker do anything twice.

## Evidence (read on 4 October 2026)

Nothing below is assumed. It is what Google's pages and discovery documents said on that day, and
what the platform's own PostgreSQL did.

- **Models** (the embeddings guide, last updated 17 September 2026): `gemini-embedding-001` —
  stable, text only, 2,048 input tokens, 3,072 dimensions by default, any size from 128 to 3,072
  (768, 1,536 and 3,072 recommended); vectors of a reduced size "must be manually normalized"; the
  task (`RETRIEVAL_DOCUMENT`, `RETRIEVAL_QUERY`, …) is a parameter. `gemini-embedding-2` — stable on
  that page, multimodal, 8,192 input tokens, the same sizes, normalised by the service, the task
  written into the text itself. The models page (1 October 2026) names the second
  `gemini-embedding-2-preview`.
- **Quality by size** (the same guide, `gemini-embedding-001`, MTEB): 3,072 not listed separately;
  2,048: 68.16; 1,536: 68.17; **768: 67.99**; 512: 67.55; 256: 66.19; 128: 63.31.
- **The API** (the discovery documents, `v1` and `v1beta`, revision 20261002): `models.embedContent`
  and `models.batchEmbedContents` on **v1**, the version the platform's Gemini adapter already uses
  (ADR-0024). A batch is `requests[]`, each with `model`, `content.parts[].text` and
  `embedContentConfig {taskType, outputDimensionality, autoTruncate, title}`; the answer is
  `embeddings[].values` "in the same order as provided" and `usageMetadata.promptTokenCount`. No
  page states a largest batch.
- **Price** (the pricing page, 1 October 2026): Gemini Embedding 2 costs $0.20 per million text
  tokens on the paid tier ($0.10 in batch mode) and is free on the free tier, where "content is used
  to improve our products". **No price is listed for `gemini-embedding-001`.**
- **Rate limits** (1 October 2026 and 2 September 2026): per project, in requests and tokens per
  minute and requests per day, by tier; over a limit the API answers `429 RESOURCE_EXHAUSTED`.
  The only embedding figure shown is Tier 1's "Gemini Embedding: 500,000" batch-enqueued tokens.
- **pgvector 0.8.7** on the platform's image (PostgreSQL 16.14, musl, `en_US.utf8`), in a throwaway
  database: `vector(n)` refuses a vector of another length ("expected 768 dimensions, not 3"); an
  HNSW index on `vector` refuses more than 2,000 dimensions; `halfvec` accepts up to 4,000;
  `vector_cosine_ops` ordered three vectors correctly; `hnsw.iterative_scan` is off and
  `hnsw.ef_search` 40 by default.

## Decision

1. **The provider.** Embeddings are a capability of the existing provider abstraction
   (`AiProvider.embed`, reserved by ADR-0027), reached only through the model router. One method
   takes a batch of texts — a single text is a batch of one — with the model, the purpose
   (`document` or `query`) and the dimension; it answers one vector per text, in order, with the
   tokens counted. `capabilities().embeddings` says whether a provider can. Only the Gemini adapter
   knows Gemini's request and answer; the rest of the platform knows texts, vectors and failure
   kinds.
   - **The fake** (`FakeAiProvider.embed`, `fakeEmbedding`): deterministic (SHA-256 of the text),
     offline, instant, of any dimension asked, at unit length — the same text always gives the
     same vector, another text another. Every automated test embeds with it or a scripted stand-in;
     no test reaches Google.
   - **Gemini** (`GeminiAiProvider.embed`): one `POST v1/models/{model}:batchEmbedContents` per
     batch, the key in the `x-goog-api-key` header alone, `autoTruncate: false` so that nothing is
     silently cut, the task `RETRIEVAL_DOCUMENT` for knowledge (`RETRIEVAL_QUERY` is ready for 8D's
     questions), `outputDimensionality` the schema's size. Its failures are the platform's kinds
     (rate limited, unavailable, timeout, auth, configuration, bad request, malformed), never its
     words.
2. **The model: `gemini-embedding-001`.** It is stable and documented in full: its task is a field
   rather than a convention in the text, its sizes have published quality figures, and its input
   limit (2,048 tokens) is far above 8B's largest chunk (2,000 characters, about 500 tokens).
   `gemini-embedding-2` adds images, audio and video, which nothing here embeds; it is named
   differently on two of Google's pages, and its task lives in the prompt. It can replace 001
   later through the re-embedding path (decision 6). An embedding model registry lists what may be
   used (`fake-embedding-1`, `gemini-embedding-001`), as the chat registry does (ADR-0025).
3. **The dimension: 768.** 67.99 against 68.17 at 1,536 — a difference of 0.18 — for half the
   storage and half the index memory; well within HNSW's 2,000 for `vector`, so no `halfvec` and
   its precision loss. The size is a **contract**, held in three places that must agree:
   `KNOWLEDGE_EMBEDDING_DIMENSION` (768) in the shared package, the column `vector(768)` with a
   CHECK on the stored dimension, and `AI_EMBEDDING_DIMENSION`, which the API refuses to start
   with at any other value. Another size is a migration, never a setting.
4. **Unit length.** Every vector is scaled to unit length before it is kept — `gemini-embedding-001`
   leaves a reduced size unnormalised — and the database checks it
   (`abs(vector_norm(embedding) - 1) < 0.001`). Cosine distance, and the inner product with it, then
   rank alike.
5. **Storage**, beside the chunks and apart from them (ADR-0026, ADR-0033):
   - `knowledge_chunk_embeddings`: one vector per chunk and contract — the chunk's whole provenance
     (institute, source, document, version, chunk; a composite foreign key to the chunk, cascading),
     the chunk's content hash when embedded, the provider, the model, the dimension, the embedding
     version and the vector `vector(768)`. Unique per (chunk, provider, model, dimension, embedding
     version). The knowledge tables themselves gain no vector column.
   - `knowledge_version_embeddings`: one run per version and contract — pending, embedding,
     embedded or failed — with the counts, the attempts, the failure code, who asked, the claim's
     time and when it finished. The database checks the dimension, the counts, that a running run
     has a claim and an embedded one its time.
6. **The contract and invalidation.** A vector is made under a contract: provider, model,
   dimension and the platform's embedding version (`embed-1`, raised when the way texts are
   prepared for embedding changes). It is **valid** only under the active contract and only while
   its content hash equals its chunk's. So a chunk is embedded again when its text or hash changes
   (8B gives a changed text a new chunk id; a stale hash is caught all the same), and everything is
   embedded again when the model, the dimension, the provider or the embedding version changes: the
   new contract's rows are written beside the old, and when a version is complete under the new
   one, its rows under every other contract are deleted. Old vectors are never compared with new
   ones and never shown: every read filters by the active contract.
7. **Eligibility**, the same rule for the request and, again, for the job when it runs: the current,
   chunked version of an active document of a published, non-archived source of the caller's
   institute, holding **public or course** data that the provider is approved for — by the
   deployment (`AI_DATA_CLASSES`) and, narrower, by the institute's AI settings. Personal knowledge
   is never embedded (held back until 8E), restricted data never leaves the platform, and nothing
   is embedded from a draft, an archived source or document, an older version or another
   institute. The reach rule is not changed: embedding grants nothing.
8. **Asking for it.** `POST /ai/knowledge/versions/:id/embed` (202), for `ai:knowledge_manage` with
   `module.ai` and `ai.knowledge` on, in the caller's institute. It is refused (409) when the
   installation cannot embed, when the version may not be embedded (the reason as a code), while a
   run holds it, and when every chunk already has a valid vector. The version's view
   (`GET /ai/knowledge/versions/:id`) carries the run — status, contract, counts, failure code —
   and the knowledge status counts the vectors; no route ever returns a vector.
9. **The job** (`ai.knowledge.embed`, pg-boss; ADR-0006). Correctness comes from the database, not
   from the queue's singleton key:
   - it does nothing while either flag is off, or while the installation cannot embed;
   - it **claims** the version's run under the active contract — pending, failed, or embedding past
     a 10-minute lease — and every later write is **fenced** by the claim's time, so a run that lost
     its lease writes nothing;
   - it checks eligibility again, loads the chunks from 8B's hand-over (`chunksForEmbedding`: the
     database alone, never the file), and embeds those **without a valid vector**, a batch at a
     time;
   - each batch's vectors are checked by the router and written, with the batch's ledger rows, in
     one transaction; a chunk's vector already there under the contract is replaced, never
     duplicated (`ON CONFLICT … DO UPDATE`);
   - it finishes only when every chunk has a valid vector, then deletes the vectors of the
     document's older versions and the version's own under other contracts, in one transaction.
10. **Batches and limits.** At most `AI_EMBEDDING_BATCH_SIZE` texts per call (32 by default, 1 to
    100), one call at a time per run, one run at a time per worker (the job's concurrency is 1);
    the router's deadline per call (`AI_TIMEOUT_MS`), the run's own of 120 seconds, the 10-minute
    lease. The run never holds more than one batch's vectors in memory, and reads only chunk ids
    and hashes back, never vectors. The router refuses an empty batch, a larger one and a text over
    the model's input limit before any call.
11. **Validation, twice and then by the database.** The adapter and the router each check that
    there is exactly one vector per text, of the dimension asked, every value a finite number, none
    without length (`VECTOR_COUNT`, `WRONG_DIMENSION`, `INVALID_VECTOR_VALUE`, `ZERO_VECTOR`); the
    column's type, the dimension CHECK and the unit-length CHECK refuse anything that got past.
    Nothing of a bad answer is kept.
12. **Failures** are codes on the run, never words. Those that may pass —
    `provider_unavailable`, `provider_rate_limited`, `provider_timeout`, `persist_failed`,
    `processing_timeout` — go back to the queue: three retries, a minute apart and growing; each
    retry goes on from what was written. Every other code (`provider_auth`,
    `provider_configuration`, `provider_bad_request`, `provider_malformed`, `wrong_dimension`,
    `invalid_vector`, `budget_exceeded`, `unpriced_model`, `embeddings_unavailable`, the
    eligibility codes, `incomplete`) ends the run until it is asked for again. Repeated provider
    failures rest the model (the router's circuit, ADR-0025): a run then makes no call.
13. **Usage** goes to the existing ledger (ADR-0029): one `ai_requests` row per call — feature
    `knowledge`, task `embed`, the provider, model, outcome, latency, tokens (Gemini's count, else an
    estimate, marked), cost when a price is configured — in the requester's day, written with the
    batch, or alone when the batch is not kept. The institute's **monthly budget** counts it, and
    with a budget set the embedding model must have a price (`AI_MODEL_COSTS`) or nothing is
    embedded: the check fails closed. It is the institute's work, so it never uses up the
    requester's own **daily allowance**: the quota check leaves knowledge tokens out.
14. **Audit**, by ids, codes and counts — never content, a vector, a prompt or a key: embedding
    asked for (the contract), started (the attempt), embedded (counts, batches, what was purged,
    the duration), failed (the code, the stage, whether it may pass); archiving a source records
    how many vectors went with it.
15. **Secrets.** The Gemini key lives in the server's environment alone (`GEMINI_API_KEY`), goes
    only in the request header, and never into a URL, an error, a log line, an audit entry, the API
    description or a database row; tests prove it with a canary key against a stand-in for `fetch`.
    Local development uses `AI_PROVIDER=fake` (`.env.example`); Gemini is chosen deliberately. A
    smoke script embeds three synthetic sentences through the real adapter
    (`pnpm --filter @lms/api ai:embed-smoke -- --confirm`); it refuses to run without that
    configuration and the flag, and prints numbers, never vectors or the key.
16. **The index.** HNSW with `vector_cosine_ops`, created by the migration with the table (built
    as rows arrive; a large reload can drop and rebuild it). Prisma 7.10 cannot describe an HNSW
    index, so it lives in raw SQL in the migration: a schema diff of the database shows it as the
    one difference (a `DROP INDEX` line that must never be applied), and an end-to-end test checks
    the index, the column type and every CHECK.
17. **Retrieval is deferred to 8D**, deliberately. A similarity search is safe only inside the reach
    rule, in the same query, with iterative index scans so that filtering does not starve the
    results, and with citations and evaluation — none of which embedding needs. 8C delivers vectors
    that 8D can filter by institute, source, document, version, course, lesson, audience, data
    class, publication, document state, current version, chunk and hash, all by joins on the
    composite keys; it delivers no route, service or query that compares vectors.

## Alternatives

- **`gemini-embedding-2`**: see decision 2. Kept as the first candidate for a later contract.
- **1,536 or 3,072 dimensions**: 0.18 points better at twice the size; 3,072 would need `halfvec`.
- **A vector column on `knowledge_chunks`**: a chunk would hold one model's vector; a change of
  model would rewrite the chunk table, and two contracts could not coexist during a switch.
- **Separate `FakeEmbeddingProvider` and `GeminiEmbeddingProvider` classes**: a second provider
  abstraction beside the one the router guards. The embedding capability of the existing adapters
  keeps one place for keys, deadlines, circuits and the ledger.
- **One call per chunk**: hundreds of requests per version where one per 32 chunks does.
- **Relying on the queue's singleton key**: it does not survive a worker that dies mid-run; the
  claim, the lease and the fence do.
- **Deleting old vectors before the new ones exist**: a window in which a document has none.
- **IVFFlat**: trained lists, rebuilt as the data grows (ADR-0026).
- **Counting embedding tokens in the requester's allowance**: an administrator who embeds the
  knowledge base would lose their own AI for the day.

## Consequences

- `lms`, `lms_test` and `lms_preview` carry the `vector` extension and the two tables (migration
  `20261011090000_phase8c_knowledge_embeddings`); local, CI and staging run
  `lms-postgres:16-pgvector-0.8.7`, built from `infra/postgres/Dockerfile`.
- A live Gemini embedding has not been made: no key is configured on the development machine. The
  adapter is proved against Google's documented contract with a stand-in for `fetch`; the smoke
  script is the first live check, run by the developer with a paid-tier key.
- `gemini-embedding-001` has no published price: an institute with a monthly budget sets one in
  `AI_MODEL_COSTS` from its own billing before embedding.
- A version must be asked for; nothing embeds on publication or ingestion yet.
- Re-embedding everything under a new contract is per version, through the same request; a bulk
  path is built when a contract changes.
- Phase 8D: similarity search filtered by the reach rule, `RETRIEVAL_QUERY` vectors for questions,
  `hnsw.iterative_scan` and `ef_search` tuned on real volumes, and the reach rule measured under
  load (ADR-0033).
- **8D record (4 October 2026; ADR-0036).** Built: the search filters inside the query, with
  iterative scans and `ef_search` at least the candidates asked for, measured on synthetic vectors
  up to 100,000 (real volumes do not exist yet); questions are embedded as `RETRIEVAL_QUERY`; the
  fake embeds by words (`fake-embedding-2`), which changed the fake's vectors — anything embedded by
  the earlier fake model is outside the active contract and is embedded again on request.
