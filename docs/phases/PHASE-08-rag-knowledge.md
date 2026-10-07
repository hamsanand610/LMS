# Phase 8 — RAG knowledge system

| Field    | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status   | **Technically complete; not production-ready** (5 October 2026) — slice 8A (knowledge architecture and vector readiness) built and approved on 4 October 2026, its migration on `lms` the same day; slice 8B (ingestion and chunking) built and approved on 4 October 2026 (the client's Phase 8C brief), its migration on `lms` the same day; slice 8C (embeddings and pgvector) built on 4 October 2026, its migration on `lms` the same day, and approved with the client's Phase 8D brief, which builds on it; slice 8D (access-controlled retrieval) built on 4 October 2026 and approved with the client's Phase 8E brief, which builds on it; slice 8E (grounded answers) built on 4 October 2026 and approved with the client's Phase 8F brief; slice 8F (hardening and closure) built on 5 October 2026 and awaiting the client's gate review. Production waits on the external Gemini gate and the blockers in `docs/phases/PHASE-08-COMPLETION.md` |
| Scope    | The client's Phase 8A brief of 4 October 2026 ("RAG foundation, knowledge architecture and vector readiness"), after the client approved Phase 7 the same day; the Phase 8B brief of the same day ("knowledge ingestion, parsing, normalization and chunking"); the Phase 8C brief of the same day ("embeddings + pgvector"); the Phase 8D brief of the same day ("access-controlled semantic retrieval"); the Phase 8E brief of the same day ("grounded RAG answer generation"); and the Phase 8F brief of 5 October 2026 ("AI knowledge / RAG production hardening and Phase 8 closure")                                                                                                                                                                                                                                                                                                                                                                    |
| Roadmap  | `docs/ROADMAP.md`, Phase 8 (RAG knowledge system). Its gate: retrieval never returns knowledge the current user is not authorised to see, proved by tests per role and scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ADRs     | ADR-0033 (the knowledge base: visibility and provenance, 8A); ADR-0034 (ingestion and chunking, 8B); ADR-0035 (embeddings and pgvector, 8C); ADR-0036 (access-controlled retrieval, 8D); ADR-0037 (grounded answers, 8E); ADR-0026 (vector storage, with its 8A and 8C records); ADR-0027 (embeddings, with the 8A decision point and the 8C decision); the Phase 7 rules it keeps: ADR-0024 (providers and data classes), ADR-0025 (the model router), ADR-0028 (observability, amended by ADR-0036 for retrievals and ADR-0037 for answers), ADR-0029 (usage and budgets), ADR-0030 (streaming), ADR-0031 (where AI is allowed)                                                                                                                                                                                                                                                                                                                             |
| Boundary | Each slice starts only with the client's go-ahead. Phase 8 owns ingestion, embeddings, pgvector, retrieval and grounded answers. Phase 9 owns agents and tools — and keeps no long-term learner memory: the learner's state is read live, per request (ADR-0040)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Slices

| Slice  | Delivers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **8A** | **Built and approved** (4 October 2026). Knowledge architecture and vector readiness: sources, documents, versions and chunks, with provenance the database enforces; visibility (audience and data class) and publication; deterministic content hashes; content kept through the storage driver; the reach rule retrieval will filter by; the management API behind `ai.knowledge` and `ai:knowledge_manage`; the ingestion job contract; a pgvector-ready PostgreSQL image, prepared and verified but not used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **8B** | **Built and approved** (4 October 2026). Ingestion and chunking (ADR-0034): Markdown, plain text and HTML read into their structure and normalised; a deterministic, structure-aware chunker; the `ai.knowledge.ingest` job on the queue, with a leased claim, its checks, a bounded read, the content's hash verified and every chunk recorded in one transaction; deterministic chunk identities; failure codes; the request and status routes; the hand-over to 8C. Not built: automatic ingestion of course material (see "Deviation")                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **8C** | **Built and approved** (4 October 2026). Embeddings and pgvector (ADR-0035): the pgvector image adopted by local, CI and staging; `gemini-embedding-001` at 768 dimensions, chosen from Google's documentation; embeddings in the provider abstraction (the fake's and Gemini's), behind the model router; the `vector` extension and two tables beside the chunks, `vector(768)` at unit length with an HNSW cosine index; the embedding contract and its invalidation; the `ai.knowledge.embed` job, claimed, leased, fenced and batched; usage in the ledger and the budget; the request route                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **8D** | **Built and approved** (4 October 2026). Access-controlled retrieval (ADR-0036): `POST /ai/knowledge/retrieve` for `ai:chat`; the scope resolved on the server by the reach rule, with a course or lesson context checked; the question embedded as `RETRIEVAL_QUERY` under the active contract; the search in one snapshot, every rule a condition before ranking — what may be ranked found by the database, then the vectors ranked under it, on the HNSW index with iterative scanning or exactly; each vector kept in its row (one migration); deterministic ranking, de-duplication, provenance for citations; bounds, failures, the ledger and the audit; an evaluation set and measured performance. Retrieval only, as its brief says: context assembly and grounded answers are 8E's                                                                                                                                                                                                                       |
| **8E** | **Built and approved** (4 October 2026). Grounded answers (ADR-0037): `POST /ai/knowledge/answer` behind a flag of its own, `ai.knowledge_answers`; 8D's retrieval reused as the one authority; an evidence floor per embedding model, measured (0.40 for the fake; Gemini's set by the deployment once measured, answers refused until then); evidence packed deterministically, with a final data-class and credential check; instructions, evidence and question kept apart, neutralised; citations `[S1]` built from retrieval's provenance and checked; one retry, then withheld; conflicts reported with their sources; a server-sent stream that writes only checked text; usage, audit, limits and failures in the platform's words; an evaluation and deliberate breaks. As decided in its brief rather than as first planned here: answers are single questions, not part of conversations; personal knowledge stays out; nothing is cached, so nothing needs invalidating; Gemini's floor waits for a key |
| **8F** | **Built** (5 October 2026). Hardening and closure: Phase 8 audited end to end (two audits, every finding verified); five fixes — no retrieval during a timed test, a linear sentence split and cuts that always advance, a credential refused at the door, source writes guarded by their state, the evidence's credential scan widened; a deterministic citation support check, measured; the whole lifecycle, idempotency and recovery proved end to end; a bounded load test; the final evaluation; the deferred register and the PDF and automatic-ingestion decisions — `docs/phases/PHASE-08-COMPLETION.md`                                                                                                                                                                                                                                                                                                                                                                                                    |

## Slice 8A — items (the client's Phase 8A brief, 4 October 2026)

| ID       | Item                                                                                                                                                                                                                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI-8A-01 | Phase 7's migrations on `lms` under the database gate (runbook §5), before any Phase 8 work                                                                                                                                                                                                         |
| AI-8A-02 | The knowledge model: `knowledge_sources`, `knowledge_documents`, `knowledge_document_versions` and `knowledge_chunks` (additive migration `20261009090000_phase8a_knowledge_base`), with composite foreign keys along the provenance chain, one current version per document, and CHECK constraints |
| AI-8A-03 | Visibility and publication: a source's audience (institute, staff, course), its data class (public, course, personal) and its state (draft, published, archived)                                                                                                                                    |
| AI-8A-04 | The reach rule, `KnowledgeReachService`: "can this person retrieve this chunk?", for Phase 8D to filter by                                                                                                                                                                                          |
| AI-8A-05 | Provenance and deterministic content hashes (SHA-256 of normalised text) for versions and chunks; one version per distinct content                                                                                                                                                                  |
| AI-8A-06 | Content kept through the existing storage driver and `files` table, owned by the institute                                                                                                                                                                                                          |
| AI-8A-07 | The ingestion contract: job names and payload, and the version's states claimed in the database                                                                                                                                                                                                     |
| AI-8A-08 | The flag `ai.knowledge` (an option, off) and the permission `ai:knowledge_manage` (the Super Admin's alone)                                                                                                                                                                                         |
| AI-8A-09 | The management API (sources, documents, versions, status), every change audited by ids, counts, hashes and states                                                                                                                                                                                   |
| AI-8A-10 | Vector readiness: `infra/postgres/Dockerfile` (pgvector v0.8.7 on `postgres:16-alpine`), verified in a throwaway container; readiness in the status route; ADR-0026's 8A record and ADR-0027's decision point                                                                                       |
| AI-8A-11 | ADR-0033, this plan, and the documentation                                                                                                                                                                                                                                                          |
| AI-8A-12 | Tests: isolation, publication, archiving, permissions, flags, provenance, hashes, duplicates, chunk ownership, audit, privacy, vector readiness, schema constraints and the embedding boundary; deliberate-break checks                                                                             |

## Slice 8B — items (the client's Phase 8B brief, 4 October 2026)

| ID       | Item                                                                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI-8B-01 | Phase 8A's migration on `lms` under the database gate (runbook §5), before any 8B work                                                                                       |
| AI-8B-02 | The formats: Markdown, plain text and HTML; PDF, Word and OCR documented as not read                                                                                         |
| AI-8B-03 | Normalisation and the reading of each format into blocks (headings, paragraphs, quotations, lists, code, tables)                                                             |
| AI-8B-04 | The chunker `sections-1`: sections first, then blocks, sentences and words; its sizes, overlap and version                                                                   |
| AI-8B-05 | The ingestion job on the queue: a leased, fenced claim; its checks; a bounded read; the hash verified; extraction; one transaction; failure codes; retries for what may pass |
| AI-8B-06 | Idempotency: chunk identities from version, position and hash; a repeated or doubled job changes nothing twice; an interrupted one is taken over and its leftovers replaced  |
| AI-8B-07 | The routes `POST /ai/knowledge/versions/:id/ingest` and `GET /ai/knowledge/versions/:id`; a source's course held by its lesson documents                                     |
| AI-8B-08 | The hand-over to 8C: `chunksForEmbedding`, from the database alone                                                                                                           |
| AI-8B-09 | Migration `20261010090000_phase8b_knowledge_ingestion`: the parser and chunker versions and the claim's time on each version                                                 |
| AI-8B-10 | Audit: ingestion asked for, started, succeeded and failed, and chunks recorded, by ids, counts, versions and codes                                                           |
| AI-8B-11 | ADR-0034, this plan, and the documentation                                                                                                                                   |
| AI-8B-12 | Tests: the readers, the chunker and the pipeline (unit); the ingestion end to end; deliberate breaks; a performance check                                                    |

## Slice 8C — items (the client's Phase 8C brief, 4 October 2026)

| ID       | Item                                                                                                                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AI-8C-01 | Phase 8B's migration on `lms` under the database gate (runbook §5), before any 8C work                                                                                                                                         |
| AI-8C-02 | The pgvector image adopted by local, CI and staging together, on the existing volumes; the local switch made with a backup and proved by identical row counts and fingerprints                                                 |
| AI-8C-03 | The model and dimension from Google's documentation as read on 4 October 2026, never assumed: `gemini-embedding-001` at 768 (ADR-0035)                                                                                         |
| AI-8C-04 | Embeddings in the provider abstraction: the fake's deterministic vectors, Gemini's `batchEmbedContents`, and the router's guards (data classes, batch and input limits, deadline, circuits, validation, the ledger's attempts) |
| AI-8C-05 | Migration `20261011090000_phase8c_knowledge_embeddings`: the `vector` extension, `knowledge_version_embeddings` and `knowledge_chunk_embeddings` (`vector(768)`), their CHECKs, and the HNSW cosine index                      |
| AI-8C-06 | The embedding contract (provider, model, dimension, embedding version) and the content hash: what makes a vector valid, and what is purged                                                                                     |
| AI-8C-07 | Eligibility, for the request and again in the job: institute, publication, current version, active document, public or course data the provider is approved for                                                                |
| AI-8C-08 | The `ai.knowledge.embed` job: a leased, fenced claim; batches; one transaction per batch; finishing and purging; failure codes; retries for what may pass                                                                      |
| AI-8C-09 | The route `POST /ai/knowledge/versions/:id/embed`; the run in the version's view; vectors counted in the status; no vector in any answer                                                                                       |
| AI-8C-10 | Usage in the ledger and the institute's budget, never the requester's own allowance; the audit by ids, codes and counts                                                                                                        |
| AI-8C-11 | Secrets: the key on the server and in the request header alone; `AI_PROVIDER=fake` for local development; the guarded smoke script                                                                                             |
| AI-8C-12 | ADR-0035, the records of ADR-0026, ADR-0027, ADR-0033 and ADR-0034, this plan, and the documentation                                                                                                                           |
| AI-8C-13 | Tests: vectors, providers, router, failures (unit); embeddings end to end; Gemini's adapter end to end against a stand-in; deliberate breaks; a performance measurement                                                        |

## Slice 8D — items (the client's Phase 8D brief, 4 October 2026)

| ID       | Item                                                                                                                                                                                                                                                                  |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI-8D-01 | The 8C state verified from the databases and the configuration before any 8D work: 18 migrations on `lms` and `lms_preview`, pgvector 0.8.7, `vector(768)`, the HNSW cosine index, `gemini-embedding-001` at 768                                                      |
| AI-8D-02 | The route `POST /ai/knowledge/retrieve`: `ai:chat`, `module.ai` and `ai.knowledge`, a rate limit, a strict request (a question, K, a course or lesson)                                                                                                                |
| AI-8D-03 | The scope on the server: the reach rule (`reachOf`), a course or lesson context checked by the course and the lesson player, context that only narrows                                                                                                                |
| AI-8D-04 | The question embedded as `RETRIEVAL_QUERY` under the active contract, through the router: data classes, credentials, allowance and budget checked first                                                                                                               |
| AI-8D-05 | The search (`KnowledgeVectorSearch`): one transaction, one snapshot; what may be ranked found by the database, then the ranking on the vectors alone, every rule a condition before ranking; HNSW with iterative scanning; a deterministic order; `statement_timeout` |
| AI-8D-06 | Selection: candidates for K, a chunk once, a text once, two passages a document at most; cosine similarity                                                                                                                                                            |
| AI-8D-07 | The result contract: provenance for citations (source, document, version, chunk, position, heading, hash, parser, chunker), never a vector                                                                                                                            |
| AI-8D-08 | Bounds and failures: a 10-second deadline, the client's leaving, the retrieval's own error codes, nothing of the database or the provider                                                                                                                             |
| AI-8D-09 | Usage in the ledger (`knowledge`/`retrieve`) and the person's allowance; one audit entry per retrieval, never the question or a passage                                                                                                                               |
| AI-8D-10 | The fake provider made lexical (`fake-embedding-2`), so retrieval can be tested and measured offline                                                                                                                                                                  |
| AI-8D-11 | The evaluation set and its measures: Recall@5, precision, MRR, the empty-result rate, latency, unauthorised results                                                                                                                                                   |
| AI-8D-12 | Performance at 1K, 10K, 50K and 100K vectors — the search, its parts, and recall against an exact search — the query plans, and the reach rule's cost per request                                                                                                     |
| AI-8D-13 | ADR-0036, this plan, the OpenAPI document and the documentation                                                                                                                                                                                                       |
| AI-8D-14 | Tests: the selection, the request's schema and the lexical fake (unit); retrieval end to end; the evaluation; deliberate breaks                                                                                                                                       |
| AI-8D-15 | One migration, `20261012090000_phase8d_knowledge_retrieval`: each vector kept in its row (`toast_tuple_target = 8160`), measured, and applied under the database procedure (backup, scratch copy, `lms_preview`, `lms`)                                               |

## Slice 8E — items (the client's Phase 8E brief, 4 October 2026)

| ID       | Item                                                                                                                                                                                                                  |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI-8E-01 | The 8D state verified before any 8E work: 19 migrations, pgvector 0.8.7, `vector(768)`, the HNSW cosine index, `gemini-embedding-001`, `KnowledgeRetrievalService`, the reach rule, the router, the ledger, the audit |
| AI-8E-02 | Generation through the provider abstraction and the model router (the `chat` task's registry model; a temperature a request may set); no provider called from the answer's service; no orchestration library          |
| AI-8E-03 | The grounded pipeline (`KnowledgeAnswerService`): checks, retrieval (8D, unchanged), evidence, the model, the check, the records; no model call before authorisation and retrieval                                    |
| AI-8E-04 | The no-evidence policy and the evidence floor, from measurements: per embedding model, Gemini's from `AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY` once measured                                                               |
| AI-8E-05 | The prompt: instructions, evidence and question apart; its version; a reference code per request                                                                                                                      |
| AI-8E-06 | Prompt injection, in the knowledge and in the question: neutralised delimiters and citations, the check, an obedient fake to test against                                                                             |
| AI-8E-07 | Protected data: a final data-class and credential check on every passage before the request is built                                                                                                                  |
| AI-8E-08 | Context packing and ordering: retrieval's order, six passages and 12,000 characters at most, identifiers in order, provenance kept                                                                                    |
| AI-8E-09 | Citations: stable identifiers, structured citations from retrieval's results, every mark checked against the evidence                                                                                                 |
| AI-8E-10 | Answer validation (deterministic) and one regeneration, then withheld                                                                                                                                                 |
| AI-8E-11 | Conflicting evidence reported with each position's source, without choosing                                                                                                                                           |
| AI-8E-12 | Streaming after retrieval and the checks, and the JSON answer, from one implementation                                                                                                                                |
| AI-8E-13 | Usage (`knowledge`/`rag_answer`), the allowance and the budget; one audit entry per answer (ADR-0028 amended); no memory, no cache                                                                                    |
| AI-8E-14 | Rate, concurrency, deadline and cancellation; the provider's failures in the answer's own codes                                                                                                                       |
| AI-8E-15 | The route, its strict request, the flag `ai.knowledge_answers`, `ai:chat`; the OpenAPI document                                                                                                                       |
| AI-8E-16 | The fake's grounded answers and a scripted provider's scenarios; the guarded live check, `ai:rag-smoke`                                                                                                               |
| AI-8E-17 | The evaluation: a corpus of 22 documents and 30 questions, groundedness and security metrics; performance                                                                                                             |
| AI-8E-18 | Tests (unit, end to end, evaluation) and 29 deliberate breaks — the brief's 24 and five more — on the final code                                                                                                      |
| AI-8E-19 | ADR-0037, this plan and the documentation; the deferred items kept; no migration                                                                                                                                      |

## Slice 8F — items (the client's Phase 8F brief, 5 October 2026)

| ID       | Item                                                                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI-8F-01 | The 8E state verified: `5073c40`, clean and in step; `lms` and `lms_preview` at 19 migrations; no Gemini key                                        |
| AI-8F-02 | The architecture audited end to end against ten categories (two read-only audits; each finding verified before acting)                              |
| AI-8F-03 | The security closure: each guarantee of 8A–8E mapped to its proof, the findings fixed, the deliberate breaks run again on the final code            |
| AI-8F-04 | The knowledge lifecycle, idempotency, failure and recovery proved end to end (`test/ai-knowledge-lifecycle.e2e-spec.ts`)                            |
| AI-8F-05 | Gemini: verified if a key exists, else recorded as the external gate; the evidence floor calibrated on Gemini, else deferred                        |
| AI-8F-06 | Citation semantic validation: the smallest defensible check (`answers/support.ts`), measured on a synthetic set of known truth, its limits recorded |
| AI-8F-07 | The final RAG evaluation (the 8E evaluation, run again on the final code)                                                                           |
| AI-8F-08 | A bounded load and concurrency test (`test/ai-knowledge-load.e2e-spec.ts`); the multi-process limits documented                                     |
| AI-8F-09 | Observability, usage and cost, storage and retention audited                                                                                        |
| AI-8F-10 | The deferred register finalised (A before production, B before a large rollout, C future); the PDF and automatic-ingestion decisions                |
| AI-8F-11 | The API and OpenAPI audited (every knowledge operation documented with its authentication); the databases audited                                   |
| AI-8F-12 | The full regression; the completion report, the ADRs' 8F records, the runbook's external-verification steps                                         |

## Ingestion (ADR-0034)

```text
version (pending) --request--> queue: ai.knowledge.ingest
  claim (lease 10 min) -> check -> read (<= 2 MiB) -> verify hash -> normalise -> read structure
  -> chunk -> record every chunk + chunked, one transaction        (or) failed + a code
```

- **Formats.** Markdown (when none is named), plain text, HTML. PDF and Word are not read: the
  platform has no engine for them and 8B adds none; OCR is out of scope.
- **Normalisation.** Strict UTF-8, NFC, LF, no control or zero-width characters (the joiners that
  Indic scripts need stay); nothing lowercased, no punctuation dropped. Markdown is taken as
  written, HTML inside it included; HTML goes through the platform's sanitiser, keeping structure
  and words only.
- **Chunks.** Sections first, cut by blocks and then by each block's grain; a target of 1,200
  characters, at most 2,000, at least 200 where the content allows; overlap only where a paragraph is
  cut, its last sentence (200 characters at most); every chunk headed by its section's path. The
  version records the chunker (`sections-1/1200-2000-200-200`) and the parser (`markdown-1`,
  `text-1`, `html-1`).
- **Idempotent.** A chunk's id comes from its version, position and hash. A chunked version is
  never taken again; two jobs never hold one version; a job that lost its lease records nothing;
  chunks an interrupted job left are replaced. The same version ingested again gives the same
  chunks, ids and hashes.
- **Failures** are recorded as codes, never content: `unsupported_format`, `missing_file`,
  `file_mismatch`, `checksum_mismatch`, `source_too_large`, `malformed_content`, `parser_failed`,
  `empty_content`, `content_too_large`, `chunking_failed`, `too_many_chunks`,
  `storage_unavailable`, `persist_failed`, `source_archived`, `document_archived`,
  `document_mismatch`, `stale_version`, `processing_timeout`. The queue tries
  `storage_unavailable` and `persist_failed` again; every other code holds until the version is
  fixed or replaced. A request is answered 409 for an archived source, a chunked version, one an
  ingestion holds and one older than the current version.
- **Limits.** 500,000 characters of source per version, 2 MiB read, 200,000 characters of text,
  1,000 chunks, 60 seconds, a 10-minute lease.
- **The lifecycle** stays ADR-0033's: pending → processing → chunked | failed. No "parsed" state:
  parsing and chunking leave nothing durable between them, and a version is chunked only in the
  transaction that writes all of its chunks.

## The contract Phase 8C consumes

`KnowledgeIngestionService.chunksForEmbedding(versionId)` gives, for each chunk of a chunked
version, from the database alone (8C never reads the file and never parses again):

| Field                                                       | What it is                                                                                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `chunkId`                                                   | The chunk's identity (a UUID from version, position and hash)                                                                     |
| `organizationId`, `sourceId`, `documentId`, `versionId`     | Its provenance                                                                                                                    |
| `position`, `heading`                                       | Its place, and its section's path                                                                                                 |
| `content`, `contentHash`, `characterCount`, `tokenEstimate` | The normalised text to embed, and its measures                                                                                    |
| `parserVersion`, `chunkerVersion`                           | Which parser and chunker made it                                                                                                  |
| `document`                                                  | The document's title, reference and lesson, for citations                                                                         |
| `visibility`                                                | Audience, course, data class, the source's state, whether the version is current — recorded by 8C, decided only by the reach rule |

Nothing is handed over for an archived source or document, another institute's version, or
personal data (held back until 8E).

## Embeddings (ADR-0035)

```text
version (chunked · current · published · public|course) --request--> run (pending) --> queue: ai.knowledge.embed
  claim (lease 10 min) -> check again -> chunks from 8B (never the file) -> those without a valid vector
  -> a batch (<= AI_EMBEDDING_BATCH_SIZE) -> router (data class, limits, deadline, circuit) -> provider
  -> vectors checked (one per text, 768, finite, unit length) -> vectors + ledger rows, one fenced transaction
  -> ... every chunk valid -> embedded + older versions' and other contracts' vectors deleted, one transaction
                                                                     (or) failed + a code
```

- **The model** is `gemini-embedding-001` at 768 dimensions, from Google's documentation as read on
  4 October 2026 (ADR-0035). Tests and local development embed with the fake: deterministic,
  offline, the same text always the same vector.
- **The contract.** A vector is valid only under the active contract — provider, model, dimension,
  embedding version (`embed-1`) — and while its hash equals its chunk's. A change of any of them
  embeds again beside the old rows, which go once the version is complete under the new contract.
- **Idempotent.** An embedded version is refused and never claimed again; two jobs never hold one
  run; a job that lost its lease writes nothing; a run that stopped goes on from the vectors it
  wrote; a vector is replaced in place, never duplicated.
- **Failures** are codes: `provider_unavailable`, `provider_rate_limited`, `provider_timeout`,
  `persist_failed` and `processing_timeout` are tried again by the queue (three times, a minute
  apart and growing); `provider_auth`, `provider_configuration`, `provider_bad_request`,
  `provider_malformed`, `wrong_dimension`, `invalid_vector`, `budget_exceeded`, `unpriced_model`,
  `embeddings_unavailable`, `incomplete` and the eligibility codes hold until asked for again.
- **Limits.** 32 texts per call by default (1 to 100), one call at a time, `AI_TIMEOUT_MS` per call,
  120 seconds per run, a 10-minute lease.
- **Usage** is in the ledger (feature `knowledge`, task `embed`) and the institute's budget; it never
  uses up the requester's own daily allowance.

## The contract Phase 8D consumes

| What                | Where                                                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The vector          | `knowledge_chunk_embeddings.embedding`, `vector(768)`, unit length; only rows of the active contract (`activeEmbeddingContract`: provider, model, dimension, embedding version)   |
| Its provenance      | `organization_id`, `source_id`, `document_id`, `version_id`, `chunk_id`: the chunk's whole key, held by a composite foreign key                                                   |
| Its validity        | `content_hash` equal to the chunk's; the version's run `embedded`                                                                                                                 |
| Who may draw on it  | The reach rule (ADR-0033), by joins in the same query: the source's institute, audience, course, data class and state; the document's lesson and state; the version being current |
| The index           | HNSW, `vector_cosine_ops` (the `<=>` operator); `hnsw.iterative_scan` and `ef_search` for filtered queries                                                                        |
| A question's vector | `ModelRouter.embed` with the purpose `query` (`RETRIEVAL_QUERY` for Gemini), under the same contract                                                                              |

8C has no route, service or query that compares vectors: retrieval is 8D's, inside the reach rule.

## Retrieval (ADR-0036)

```text
POST /ai/knowledge/retrieve { query, topK?, courseId? | lessonId? }        (ai:chat · module.ai · ai.knowledge · 30/5 min)
  context checked (course reached · lesson open) -> question classified (credential? data class approved?)
  -> allowance and budget -> scope: reachOf(person) + context        -> question embedded (RETRIEVAL_QUERY, active contract)
  -> one transaction, one snapshot: what may be ranked (published · retrievable class · context · active documents · no
     closed lesson · current versions) -> ranking on the vectors alone: institute · active contract · those sources,
     documents and versions  ORDER BY cosine distance (HNSW, iterative) -> each joined to its chunk while its hash holds
  -> candidates by (distance, chunk id) -> a chunk once · a text once · two per document -> top K + provenance
  -> ledger (knowledge/retrieve) · audit (ai.knowledge.retrieval) · log (numbers)
```

- **Who may ask.** `ai:chat`, which every role holds, with `module.ai` and `ai.knowledge` on; at most 30
  retrievals in five minutes. The request is strict: anything beyond the question, K and a context
  is refused.
- **What may be drawn on** is decided on the server: the reach rule (ADR-0033) for each request, and
  a course or lesson context checked as the course and the lesson player check it. Context only
  narrows.
- **Never filtered afterwards.** Every rule is a condition before ranking, so an unauthorised
  passage is never a candidate and never displaces an authorised one; the state conditions
  (published, retrievable class, active, current, chunked, contract) are found by the database in
  the search's own snapshot, whatever the scope says. Only a vector whose hash is no longer its
  chunk's — which only a change outside the platform makes — is dropped after ranking.
- **Ranking** by cosine distance, then chunk id: the same question over the same knowledge gives the
  same passages in the same order. A text once, two passages of one document at most.
- **Failures** are the retrieval's own: `knowledge_retrieval_unavailable` (503),
  `knowledge_retrieval_timeout` (504), `knowledge_retrieval_failed` (502 or 500),
  `knowledge_retrieval_forbidden` (403), beside the platform's.
- **Records.** One ledger row per question embedded (no question, no passage), counted in the
  person's allowance; one audit entry per retrieval (ids and counts); one log line (numbers).
- **No cache** and no new index. One migration keeps each vector in its row (see Performance).

## Retrieval: evaluation and performance (8D)

**Evaluation** (AI-8D-11; `test/ai-knowledge-retrieval-evaluation.e2e-spec.ts`). Through the API, as
two learners of one course, over a synthetic corpus (`test/fixtures/knowledge-retrieval-corpus.ts`):
21 documents — the institute's, a course's, a lesson's and staff material, with drafts, archived
material, personal knowledge and another institute's beside them — and 32 questions: exact
wording, paraphrases, two topics at once, from a course, from a lesson, a text held twice, two with
no answer and seven aimed at what the learners may not draw on. With the lexical fake
(`fake-embedding-2`):

| Kind of question | Questions | Recall@5 | Precision@1 | Precision@5 | MRR |
| ---------------- | --------- | -------- | ----------- | ----------- | --- |
| exact            | 10        | 1        | 1           | 0.2         | 1   |
| paraphrase       | 8         | 1        | 1           | 0.2         | 1   |
| multi-topic      | 2         | 1        | 1           | 0.4         | 1   |
| course           | 1         | 1        | 1           | 0.2         | 1   |
| lesson           | 1         | 1        | 1           | 0.2         | 1   |
| duplicate        | 1         | 1        | 1           | 0.2         | 1   |

- Overall: Recall@5 1.0, MRR 1.0, no question without a passage. Precision@5 is 0.2 where one
  passage answers a question and five are returned.
- **Unauthorised passages returned: 0** — every passage checked against the reach rule's own
  answer (`mayRetrieve`) for the person who asked, and against the documents each boundary question
  aimed at.
- The questions with no answer: a top similarity of 0.21 at most, against 0.43 at least for
  answered ones — the kind of gap 8E's minimum similarity will be
  calibrated on, with Gemini's vectors.
- Through the API: median 74 ms, 95th percentile 93 ms.
- Not shown: meaning. The fake matches words, so a paraphrase sharing none, synonyms and other
  languages wait for Gemini's vectors (deferred: retrieval measured with Gemini).

**Performance** (AI-8D-12; Step 26). Measured on 4 October 2026 on the development machine
(Windows 11, 7.2 GB of memory; PostgreSQL 16.14 and pgvector 0.8.7 in Docker Desktop) in `lms_test`,
with a measurement script not kept in the repository: vectors with the structure of text embeddings
(200 topics in 24 intrinsic dimensions mapped into 768, seeded), in documents of 100 chunks over
eleven sources — eight for the institute, the course the learner reaches (a tenth of the vectors),
staff material, and a small source (a hundredth). Each search 20 times with 20 questions, warm;
recall against an exact ranking of the same rows. Times in milliseconds, median / 95th percentile:

| Vectors | In scope: broad / one source / small | Broad, K 5  | Broad, K 20  | One source, K 5 | Small source, K 5 | Reach rule | Whole request |
| ------- | ------------------------------------ | ----------- | ------------ | --------------- | ----------------- | ---------- | ------------- |
| 1,000   | 900 / 100 / 100                      | 23.1 / 32.7 | 20.1 / 30.5  | 16.7 / 30       | 14.3 / 18.6       | 8.4        | 57.5 / 121.3  |
| 10,000  | 9,000 / 1,000 / 100                  | 15.1 / 18   | 18.5 / 26.4  | 22.1 / 41.3     | 14.4 / 17         | 7.4        | 61.6 / 98.1   |
| 50,000  | 45,000 / 5,000 / 500                 | 21.3 / 59   | 20.4 / 43.3  | 29.9 / 64.3     | 18 / 20.3         | 6.9        | 54.8 / 154.2  |
| 100,000 | 90,000 / 10,000 / 1,000              | 25 / 45.2   | 26.5 / 176.9 | 21.9 / 25.4     | 15.7 / 19.2       | 8.8        | 60.3 / 118.4  |

- **The search** (`KnowledgeVectorSearch`, both statements and its transaction) takes 14 to 30 ms
  at the median at every size (the 95th percentile 65 ms at most, but 177 ms once); the statements
  themselves take 1 to 11 ms (below), and the rest is the transaction's round trips between the API
  and the database on this machine.
- **The question's embedding**: under a millisecond with the fake (the ledger's latency 0). Gemini's
  is not measured: no key on this machine.
- **Authorisation**: the reach rule 7 to 9 ms a request (above); what may be ranked, under 1 ms in
  the database (below). With lesson documents — measured separately, a learner enrolled in one
  course whose later half of modules is locked:

| Lesson documents | Closed to the learner | Asked one lesson at a time | Asked all at once |
| ---------------- | --------------------- | -------------------------- | ----------------- |
| 0                | 0                     | 6.9 ms                     | 8 ms              |
| 10               | 0                     | 96.6 ms                    | 24 ms             |
| 50               | 20                    | 729.9 ms                   | 28.3 ms           |
| 200              | 100                   | 2,984 ms                   | 31.4 ms           |

Asked one lesson at a time, the rule grew by about 15 ms a lesson; 8D asks about them all at once
(`LessonsService.openLessonIds`: the player's own rule, one walk of each course's modules), with
the same answers.

- **The whole request** (session, permission, flags, reach, classification, allowance, embedding,
  search, selection, ledger, audit): about 60 ms at the median at every size.
- **Storage**: each vector in its row — at 100,000 vectors the table 391 MB, its HNSW
  index 391 MB, the TOAST table 0 bytes. Before the 8D migration (vectors out of line, the
  same 50,000 rows), an exact ranking of the top 80 took about 250 ms over 10,000 vectors and
  700 ms over 45,000; with whole rows, 18 ms and 90 ms. With vectors out of line, the planner ranked
  a broad scope of 10,000 exactly in 240 ms; with whole rows it orders it by the HNSW index in 15.
- Not shown: production volumes, Gemini's vectors (their structure decides HNSW's recall), many
  people at once, a cold cache after a restart (deferred: retrieval at production scale).

**Query plans** (Step 27; `EXPLAIN (ANALYZE, BUFFERS)` of the search's own statements, in its
transaction, with its settings):

| Vectors | Scope        | Candidates | Ranked by                        | Recall against exact | Rows from the scan | Filtered out | Buffers | Ranking (ms) | What may be ranked (ms) |
| ------- | ------------ | ---------- | -------------------------------- | -------------------- | ------------------ | ------------ | ------- | ------------ | ----------------------- |
| 1,000   | broad        | 20         | exact, sequential                | 1 (lowest 1)         | 900                | 100          | 647     | 3.694        | 0.276                   |
| 1,000   | broad, K 20  | 80         | exact, sequential                | 1 (lowest 1)         | 900                | 100          | 1,007   | 5.309        | 0.195                   |
| 1,000   | one source   | 20         | exact, (institute, source) index | 1 (lowest 1)         | 100                | 0            | 198     | 1            | 0.147                   |
| 1,000   | small source | 20         | exact, (institute, source) index | 1 (lowest 1)         | 100                | 0            | 198     | 1.055        | 0.236                   |
| 10,000  | broad        | 20         | HNSW                             | 1 (lowest 1)         | 20                 | 3            | 487     | 1.105        | 0.276                   |
| 10,000  | broad, K 20  | 80         | HNSW                             | 0.995 (lowest 0.975) | 80                 | 11           | 1,776   | 5.204        | 0.206                   |
| 10,000  | one source   | 20         | HNSW                             | 0.988 (lowest 0.9)   | 20                 | 234          | 2,483   | 10.494       | 0.47                    |
| 10,000  | small source | 20         | exact, (institute, source) index | 1 (lowest 1)         | 100                | 0            | 232     | 0.721        | 0.189                   |
| 50,000  | broad        | 20         | HNSW                             | 1 (lowest 1)         | 20                 | 2            | 606     | 1.584        | 0.29                    |
| 50,000  | broad, K 20  | 80         | HNSW                             | 1 (lowest 1)         | 80                 | 8            | 1,367   | 6.639        | 0.413                   |
| 50,000  | one source   | 20         | HNSW                             | 0.993 (lowest 0.9)   | 20                 | 209          | 1,119   | 3.453        | 0.308                   |
| 50,000  | small source | 20         | exact, (institute, source) index | 1 (lowest 1)         | 500                | 0            | 472     | 1.89         | 0.388                   |
| 100,000 | broad        | 20         | HNSW                             | 0.997 (lowest 0.95)  | 20                 | 0            | 751     | 3.271        | 0.63                    |
| 100,000 | broad, K 20  | 80         | HNSW                             | 0.998 (lowest 0.975) | 80                 | 4            | 1,625   | 7.042        | 0.41                    |
| 100,000 | one source   | 20         | HNSW                             | 0.995 (lowest 0.95)  | 20                 | 248          | 1,399   | 4.1          | 0.371                   |
| 100,000 | small source | 20         | exact, (institute, source) index | 1 (lowest 1)         | 1,000              | 0            | 742     | 2.785        | 0.398                   |

- A broad scope is ordered by `knowledge_chunk_embeddings_embedding_hnsw_idx`
  (`Order By: embedding <=> query` — cosine distance), with every condition of the scope in that
  scan's filter: the institute, the contract (provider, model, dimension, embedding version), the
  sources, and the documents and versions left out. Iterative scanning passes over the rows the
  filter removes ("Filtered out") until the candidates are found.
- A small scope is ranked exactly: `knowledge_chunk_embeddings_organization_id_source_id_idx`, then
  a top-N sort by the same distance. At 1,000 vectors a sequential scan of the table is cheaper than
  either, and the planner takes it.
- The candidates are joined to their chunks (hash included), versions, documents and sources by
  primary or unique keys. What may be ranked reads the sources, documents and versions of the
  scope (sequentially at these sizes; the versions' vectors by `knowledge_chunk_embeddings_version_id_idx`).
- The vectors' table is never read whole for a broad scope at 10,000 vectors or more, and no vector
  is read out of line.
- **Strategy:** no new index. The planner chooses the HNSW index or an exact ranking from the
  vectors' own statistics; the one change is each vector kept in its row (ADR-0036, decisions 5 and
  14). Against an exact ranking, the HNSW index found 0.988 of the passages or more on average for
  every scope, and 0.9 for the worst single question (two passages of twenty).

## The contract Phase 8E consumes

| What                        | Where                                                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The service                 | `KnowledgeRetrievalService.retrieve(user, request, signal)`: the same checks, scope and search as the route, for a question within a conversation           |
| Each passage                | Its text, heading and position; source, document and version with their ids, title, reference, lesson, parser and chunker; its content hash; its similarity |
| What may go to the provider | Decided by each passage's data class (`source.dataClass`) against the institute's approvals, before any is sent                                             |
| Citations                   | From the provenance alone: document title and reference, version number, heading and position                                                               |
| A minimum similarity        | None in 8D; calibrated on Gemini's embeddings in 8E                                                                                                         |

**8E record.** Consumed as described, for single questions rather than within a conversation; the
minimum similarity is calibrated per embedding model (0.40 for the fake; Gemini's once measured),
and personal knowledge stays out (ADR-0037).

## Grounded answers (ADR-0037)

```text
POST /ai/knowledge/answer { query, courseId? | lessonId?, stream? }    (ai:chat · module.ai · ai.knowledge · ai.knowledge_answers · 20/5 min)
  flags -> no timed test -> institute settings -> question classified (credential? 422) -> a model may answer it
  -> an evidence floor for the active embedding model (none: 503) -> allowance and budget -> one at a time, 8 at once
  -> KnowledgeRetrievalService.retrieve (8D, unchanged: scope, embedding, search, ledger, audit), 8 passages
  -> evidence: retrieval's order; similarity >= floor · data class approved now · no credential · 6 passages, 12,000
     characters -> S1, S2, …   (none -> insufficient_evidence, no model call)            [stream: meta]
  -> ModelRouter.chat (chat task's model): system = instructions + reference code; user = <evidence><passage id="S1" …>
     … </evidence><question> … </question>, neutralised; temperature 0.2; 1,024 tokens
  -> checkAnswer: empty · length · instructions or code · credential · decline · conflict · unknown citation ·
     no citation · uncited sentence   (fault -> once more with a reminder -> not_grounded)
  -> citations from retrieval's results -> answered | conflicting | insufficient_evidence | not_grounded
  -> ledger (knowledge/rag_answer, a question of theirs) · audit (ai.knowledge.answer) · log (numbers)
                                                                                [stream: delta… sources notice usage done]
```

- **Who may ask.** `ai:chat` with `module.ai`, `ai.knowledge` and `ai.knowledge_answers` on (the
  last off by default); at most 20 answers in five minutes, one at a time each, eight at once per
  process; never during a timed test. The request is strict: a question, a course or lesson, and
  `stream` — passages, citations, a prompt, a model or an institute are refused.
- **Retrieval decides what may be drawn on**; the answer only removes: below the floor, a data class
  the provider may not be given now, a credential, beyond the bounds. The passages withheld are
  counted by reason in the audit entry.
- **The evidence floor** is per embedding model, from measurements (below). Under a Gemini contract
  answers are refused until `AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY` is set from Gemini's own
  measurements: a guessed floor would decide what counts as evidence.
- **Data and instructions apart.** The instructions alone in the system channel; the passages and
  the question as data in the person's, inside delimiters text cannot close, citation-shaped text
  rewritten. The model is the `chat` task's from the registry, through the router.
- **Nothing unchecked is shown.** The answer is checked whole — the instructions or the request's
  code, a credential, any citation mark that is not exactly one of the evidence's identifiers, no
  citation, a sentence without one — once more with a reminder if it fails, then withheld in the
  platform's words. Citations come from retrieval's results, never from the model's text. The
  stream writes the answer only once it is checked.
- **Declines** say "I couldn't find enough information in the available SI Academy knowledge to
  answer that reliably." — no general knowledge instead. **Conflicts** give each position with its
  source and send the reader to the course team or the authoritative source.
- **Failures** are the answer's own: `knowledge_answer_unavailable` (503), `knowledge_answer_timeout`
  (504), `knowledge_answer_failed` (502), `ai_busy` (503), beside retrieval's and the platform's.
- **Records.** Each model call in the ledger as `knowledge`/`rag_answer`, counted as a question of
  the person's and in the budget; one audit entry per answer — status, reason, counts, the
  documents cited, the model, times — never the question, a passage, the answer, the instructions
  or a key. No conversation, no memory, no cache.

## Grounded answers: evaluation and performance (8E)

**Calibration** (AI-8E-04; `test/ai-knowledge-answers-evaluation.e2e-spec.ts`). Each question of the
evaluation, asked through `POST /ai/knowledge/retrieve` as one of three learners of one course, and
the similarity of its closest passage, with the lexical fake (`fake-embedding-2`):

| Questions                                                  | Count | Closest passage              |
| ---------------------------------------------------------- | ----- | ---------------------------- |
| The corpus answers them (answered, conflicting)            | 11    | 0.495 at the least           |
| It cannot (no answer, irrelevant, protected, out of reach) | 11    | 0.298 at the most            |
| The floor                                                  | —     | 0.40, the midpoint (rounded) |

The eight others are not measured: three whose closest passage holds a planted instruction, one
whose passage holds a credential, and four with instructions in the question — their outcome is the
checks', whatever the floor. Gemini's similarities are another scale; its floor is measured the same
way once a key is configured (`ai:rag-smoke -- --confirm --calibrate` for a first look).

**Evaluation** (AI-8E-17). Through the API, as three learners of one course, over a synthetic
corpus (`test/fixtures/knowledge-answer-corpus.ts`): 22 documents — the institute's, a course's, a
lesson's, two that disagree, three with planted instructions (prompt-extraction, a role switch, a
code block), markup with a script and forged tags, a forged citation, a credential, staff material,
another course's, a personal note, a draft, an archived document and another institute's — and 30
questions: factual, paraphrased, two passages at once, from a course, from a lesson, ambiguous,
conflicting, unanswerable, irrelevant, a protected-data request (a reference solution, another
learner's answer), instructions in the question, and six aimed at what the learners may not draw
on. With the fake's obedient grounded answers:

| Measure                                                                                                           | Result       |
| ----------------------------------------------------------------------------------------------------------------- | ------------ |
| Answerable questions answered (or conflict shown)                                                                 | 11 of 11     |
| Answerable questions refused wrongly                                                                              | 0            |
| Unanswerable questions declined or withheld                                                                       | 19 of 19     |
| Citations returned; valid (in the text, in reach, drawn by that request's retrieval and named by its audit entry) | 14; 14 (1.0) |
| Answers' sentences without a citation                                                                             | 0            |
| UNAUTHORIZED_INFORMATION                                                                                          | 0            |
| PROTECTED_DATA_LEAKS                                                                                              | 0            |
| FABRICATED_CITATIONS                                                                                              | 0            |
| PROMPT_INJECTION_SUCCESS                                                                                          | 0            |

**Performance** (one development machine; the fake provider, so the model's time is near nought and
the figures are the platform's own overhead): an answer took 91 ms at the median and 106 ms at the
95th percentile through the API; retrieval 57 and 62 ms, of which the question's embedding 38 and
42 ms and the search 18 and 20 ms; the model's part 1 and 6 ms. Streamed, `meta` arrived after 73
ms (median; 118 at the 95th percentile) and the first `delta` after 97 ms (148) — with the whole
answer, as it is written only once checked. The evidence held 162 characters at the median and
353 at most (bounded at 12,000); the instructions are 1,282 characters (about 320 tokens), so the
largest request is about 15,300 characters, about 3,800 tokens, with 1,024 output tokens at most.
Gemini's latency and token use are measured with a key; nothing was tuned for speed in this slice.

## Deviation: course material

This plan first placed automatic ingestion of course material in 8B — lessons as documents, kept
current by publish, update and unpublish events. The client's 8B brief does not ask for it, and 8B
does not build it. A course source can hold lesson documents whose versions an administrator adds
(HTML or Markdown) and ingests today. Building the automatic path, and in which slice, is the
client's decision.

## Deferred items — carried forward

The final register, classified by when each item is needed (before production, before a large
rollout, future), is section 14 of `docs/phases/PHASE-08-COMPLETION.md`; the table below is the
history of where each came from. Each item stays until a slice takes it up, with the client's
go-ahead; none is built because it is listed.

| Item                                     | From    | Where it stands                                                                                                                                                   | When                                                                 |
| ---------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| The 8B migration on `lms`                | 8B      | Done on 4 October 2026, under the database gate, before any 8C work (progress log, session 37)                                                                    | —                                                                    |
| ADR-0034                                 | 8B      | Accepted; the authoritative ingestion and chunking decision                                                                                                       | —                                                                    |
| Automatic ingestion of course material   | 8B plan | Not built (see "Deviation"); lesson documents are added and ingested by hand                                                                                      | A later slice, on the client's decision                              |
| PDF; Word, PowerPoint and OCR            | 8B      | Not read; a PDF is refused when a version is created                                                                                                              | Before production RAG, if the real corpus needs it                   |
| Topics, skills, batch and role audiences | 8A      | Not in the model                                                                                                                                                  | A later slice with a migration, if the client wants them             |
| Purging knowledge                        | 8A      | Archiving withdraws a source and now deletes its vectors; nothing deletes knowledge                                                                               | When asked for                                                       |
| Re-chunking under a new chunker version  | 8B      | No path yet                                                                                                                                                       | When a chunker version changes                                       |
| Personal knowledge                       | 8A      | Held back: neither retrieved, embedded nor answered from (8E kept it out, ADR-0037)                                                                               | A later slice, deciding whose personal data may be drawn on for whom |
| Automatic and bulk embedding             | 8C      | A version is asked for; a new contract is applied version by version                                                                                              | When a contract changes, or the client asks                          |
| A live Gemini embedding                  | 8C      | Not made: no key on the development machine; the smoke script is ready                                                                                            | The developer, with a paid-tier key                                  |
| A price for `gemini-embedding-001`       | 8C      | Google lists none; needed only with a monthly budget                                                                                                              | The institute, from its own billing                                  |
| CI's image from a registry               | 8C      | Built on each run                                                                                                                                                 | If the build time matters                                            |
| Prisma and the HNSW index                | 8C      | Raw SQL; a schema diff shows its `DROP INDEX`, never to be applied                                                                                                | Until Prisma can describe HNSW                                       |
| The reach rule under load                | 8A      | Resolved per request; its cost measured with up to 200 lesson documents (8D); not load-tested with many people at once                                            | Phase 12 (performance), or before staging                            |
| Retrieval at production scale            | 8D      | Measured to 100,000 synthetic vectors on one development machine                                                                                                  | Phase 12 (performance), with real volumes                            |
| A minimum similarity for answers         | 8D      | Calibrated for the fake (0.40, 8E); for Gemini none — answers refused under a Gemini contract until `AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY` is set from measurements | With the live Gemini check                                           |
| Retrieval measured with Gemini           | 8D      | Measured with the lexical fake; Gemini's quality needs a key                                                                                                      | With the live Gemini check                                           |
| A retrieval cache                        | 8D      | Not built: results depend on reach and state (ADR-0036)                                                                                                           | Only if measured need, with every scope in its key                   |
| A live Gemini answer                     | 8E      | Not made: no key on the development machine; `ai:rag-smoke` is ready                                                                                              | The developer, with a key                                            |
| Answer limits tuned on Gemini            | 8E      | Temperature 0.2, 1,024 output tokens, six passages and 12,000 characters, chosen with the fake                                                                    | With the live Gemini check                                           |
| Checking what a cited passage says       | 8E      | Since 8F a deterministic support check (numbers, half the words), measured; semantic validation (meaning) deferred                                                | Phase 8F or later, on the client's decision                          |
| Answers in conversations                 | 8E      | Single questions; nothing stored but the ledger and the audit (ADR-0037)                                                                                          | With a retention decision for cited answers                          |
| A page for answers                       | 8E      | The API only; no web page asks it yet                                                                                                                             | On the client's decision                                             |
| One answer at a time across processes    | 8E      | Held in each API process's memory, like the rate limiter (ADR-0006)                                                                                               | With more than one API process (Phase 12)                            |

## The knowledge model (ADR-0033)

```text
knowledge_sources              one institute · audience · data class · draft → published → archived
└─ knowledge_documents         a reference unique in its source · perhaps one lesson · active | archived
   └─ knowledge_document_versions   numbered · hashed · a file · pending → processing → chunked | failed
      └─ knowledge_chunks       position · heading · text · hash
```

- **Provenance the database enforces.** Each row carries its parents' whole key, held by composite
  foreign keys: a document to (source, institute), a version to (document, source, institute), a
  chunk to (version, document, source, institute). A chunk whose names disagree with its version
  cannot be written, so there is no knowledge without valid provenance.
- **One current version.** A partial unique index allows one current version per document, and a
  CHECK allows only a chunked version to be current.
- **Hashes.** A version and each chunk carry the SHA-256 of their text, normalised (NFC, LF line
  ends, no trailing spaces or tabs, no blank lines at either end). The same content in another form
  is refused as a duplicate; any change of words is the next version.
- **Storage.** A version's text goes through the storage driver into the private bucket, with a
  `files` row (`knowledge-version`, its checksum the content hash) that names no uploader. The files
  API never serves it by id: only the knowledge base reaches it.

## The security model: who may draw on a chunk

`KnowledgeReachService` is the knowledge base's one answer, and Phase 8D's retrieval filters by it
in the same query as its similarity search. A chunk may be drawn on for a person only when all of
these hold, read from the database at the time of asking:

1. **The person's own institute.**
2. **A published source** — never a draft, never an archived one.
3. **A data class the provider may be given**: public or course. Personal knowledge is held back
   until Phase 8E weighs it against the institute's approvals (ADR-0024); restricted material is
   refused by the database.
4. **An audience that includes them**:
   - `institute`: everyone in the institute;
   - `staff`: whoever is no learner (no student profile);
   - `course`: a course they reach (`CoursesService.reachableCourseIds`), and for a document about
     one lesson, that lesson as the player would open it (`LessonsService.aiContextFor`).
5. **The current, chunked version of an active document.**

Management is separate: `ai:knowledge_manage`, while `module.ai` and `ai.knowledge` are both on.
Management reads only the caller's institute; another institute's source is not found.

## What 8A does not do

No embeddings, embedding calls or vectors; no similarity search, retrieval endpoint, RAG answers,
RAG chat or citations; no ingestion handler, crawling, scraping or automatic ingestion; no agents,
tools or function calling, long-term memory, mock interviews or voice; no AWS change, Bedrock,
Redis, LangChain or LangGraph; no page in the web app. No Gemini call: no test or route reaches a
provider.

## Phase 8 prerequisites — where they stand

Phase 7's plan set these before Phase 8 (`docs/phases/PHASE-07-ai-foundation.md`).

| #   | Prerequisite                                                                                | At Phase 8A                                                          |
| --- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | The client approves Phase 7                                                                 | Done: the client's Phase 8A brief, 4 October 2026                    |
| 2   | Phase 7's migrations on `lms` under the database gate                                       | Done on 4 October 2026 (progress log, session 35)                    |
| 3   | A PostgreSQL image with pgvector in local, CI and staging together                          | Prepared and verified (`infra/postgres/Dockerfile`); adopted in 8C   |
| 4   | The embedding model chosen and recorded                                                     | The decision point is recorded (ADR-0027); the model is chosen in 8C |
| 5   | Gemini on a paid tier before real learner data; AI flags on only with the client's approval | Unchanged; no provider call in 8A                                    |
| 6   | The knowledge sources and their visibility metadata agreed                                  | Proposed by ADR-0033; awaits the client's review of 8A               |

## The 8A matrix

| Area             | Rule                                                                                                                | Where                                                      | Proof                                                | Result |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------- | ------ |
| Institutes       | Every row belongs to one institute; management and reach filter by it; composite keys keep the copies true          | `KnowledgeService`, `KnowledgeReachService`, the migration | e2e "stays in its own institute"; breaks 1 and 2     | Pass   |
| Publication      | Draft and archived sources reach nobody; published once; archived for good                                          | `reachOf`, `publishSource`, `archiveSource`                | e2e states, publishing and archiving; breaks 3 and 7 | Pass   |
| Versions         | Only the current, chunked version of an active document                                                             | `whereRetrievable`; the current-version index and CHECK    | e2e states and constraints; break 6                  | Pass   |
| Audiences        | Institute, staff alone, or a course's reach down to the lesson                                                      | `reachOf`, `reachableCourseIds`, `aiContextFor`            | e2e audiences; break 8                               | Pass   |
| Data classes     | Public and course only; personal held back; restricted refused by the database                                      | `RETRIEVABLE_DATA_CLASSES`; CHECK                          | e2e states and constraints                           | Pass   |
| Permission       | `ai:knowledge_manage` on every route; the Super Admin's alone                                                       | `KnowledgeController`                                      | e2e management; break 4                              | Pass   |
| Flags            | `module.ai` and `ai.knowledge`, both; off by default                                                                | `KnowledgeService`, the module guard, the manifest         | e2e management; break 5                              | Pass   |
| Provenance       | No chunk unless its version, document, source and institute agree                                                   | composite foreign keys                                     | e2e constraints and ingestion                        | Pass   |
| Hashes           | SHA-256 of normalised text; one version per content                                                                 | `content-hash.ts`; unique (document, hash)                 | unit tests; e2e duplicates                           | Pass   |
| Ingestion states | Claimed in the database; chunks only for a claimed version; the newest chunked is current                           | `claimForIngestion`, `recordChunks`, `failIngestion`       | e2e ingestion                                        | Pass   |
| Storage          | Through the storage driver, private, a `files` row with its checksum and no uploader; never served by the files API | `createVersion`, `FilesService`                            | e2e storage; break 9                                 | Pass   |
| Audit            | Every change by ids, counts, hashes and states — never content                                                      | the service's audit calls                                  | e2e storage and ingestion                            | Pass   |
| Privacy          | A learner's erasure leaves the knowledge base and its files whole                                                   | `users/privacy.service.ts`, unchanged                      | e2e privacy                                          | Pass   |
| Vector readiness | The status tells the truth; no vector column anywhere                                                               | `VectorReadinessService`, `infra/postgres/Dockerfile`      | e2e vector readiness; the throwaway container        | Pass   |
| Database         | `lms` at Phase 7 with no knowledge tables; the test and preview databases match the schema                          | migration `phase8a`                                        | schema diff; migration counts                        | Pass   |

The breaks are the deliberate-break checks of session 35, each caught and restored byte for byte.

## The 8B matrix

| Area                 | Rule                                                                                                           | Where                                           | Proof                                                                            | Result |
| -------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------- | ------ |
| Determinism          | The same content, in any form, gives the same chunks, ids and hashes                                           | `pipeline.ts`, `chunker.ts`, `knowledgeChunkId` | unit (forms, repeats); e2e (taken again)                                         | Pass   |
| Idempotency          | A chunked version is never taken again; one holder at a time; a lost lease records nothing; leftovers replaced | `claim`, `recordChunks`                         | e2e (twice, half-way, lease); break 7                                            | Pass   |
| Institutes           | The job takes only its own institute's versions; the request finds only the caller's                           | `claim`, `request`                              | e2e (institute B); breaks 1 and 3                                                | Pass   |
| Publication          | Archived sources and documents are not ingested; ingestion publishes nothing; personal data reaches nobody     | the job's checks, the reach rule                | e2e (archived, draft, personal); breaks 4 and 10                                 | Pass   |
| Relationships        | A lesson document's lesson is in its source's course; a source's course stays while it has lesson documents    | the job's checks, `updateSource`                | e2e (course moved); break 2                                                      | Pass   |
| Permission and flags | The request for `ai:knowledge_manage`, both flags on; the job waits while either is off                        | `KnowledgeController`, `ingest`                 | e2e (roles, flags, no session); break 5                                          | Pass   |
| Files                | The file is the version's own; its hash verified; read within the limit; never served by the files API         | the job's checks                                | e2e (borrowed, other context, other folder, tampered, oversized); breaks 6 and 8 | Pass   |
| Structure            | Headings, paragraphs, code, lists and tables kept; nothing dropped                                             | `markdown.ts`, `html.ts`, `chunker.ts`          | unit (readers, chunker)                                                          | Pass   |
| Sizes                | Every chunk within 2,000 characters; none needlessly small; overlap a sentence at most                         | `chunker.ts`                                    | unit (sizes, overlap, stress)                                                    | Pass   |
| Provenance           | Every chunk keeps its institute, source, document, version, position and section                               | `recordChunks`                                  | e2e (formats, 8C contract); break 9                                              | Pass   |
| Invalid input        | Empty, scripts only, not UTF-8, too large, too many chunks, unread types: refused by code                      | `pipeline.ts`, the job                          | unit; e2e                                                                        | Pass   |
| Audit                | Asked for, started, succeeded, failed, chunks recorded — ids, counts, versions, codes; never content           | `request`, `recordState`                        | e2e (audit)                                                                      | Pass   |
| The 8C contract      | Everything an embedding needs, from the database alone                                                         | `chunksForEmbedding`                            | e2e (file deleted first)                                                         | Pass   |
| Database             | `lms` at Phase 8A (16 migrations); the 8B migration on the test and preview databases only                     | migration `phase8b`                             | schema diff; migration counts                                                    | Pass   |

The breaks are the deliberate-break checks of session 36, each caught and restored byte for byte.

## The 8C matrix

| Area                  | Rule                                                                                                                                                        | Where                                                      | Proof                                                                                | Result |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------ |
| Institutes            | The job claims only its institute's runs; the request finds only the caller's versions; no vector can be filed under another institute's chunk              | `embed`, `request`; the composite key                      | e2e "keeps to its institute"; breaks 1 and 2                                         | Pass   |
| Permission and flags  | The request for `ai:knowledge_manage`, both flags on; the job waits while either is off                                                                     | `KnowledgeController`, `embed`                             | e2e (roles, flags, no session); breaks 3 and 4                                       | Pass   |
| Eligibility           | Only the current, chunked version of an active document of a published source, public or course data the provider is approved for; checked again by the job | `ineligibility`                                            | e2e "embeds only what may be drawn on"; breaks 5 to 9                                | Pass   |
| Vectors               | One per text, 768 values, finite, unit length — checked by the adapter, the router and the database                                                         | `checkedVectors`, `unitVector`; the column type and CHECKs | unit (vectors, router, Gemini); e2e "refuses what is not a vector"; breaks 10 and 11 | Pass   |
| Idempotency           | An embedded version is never claimed again; one holder at a time; a lost lease writes nothing; a vector replaced, never duplicated                          | the claim, the fence, `ON CONFLICT`                        | e2e (twice at once, the lease, taken over); breaks 12 and 13                         | Pass   |
| Taking a run up again | Only the chunks without a valid vector are embedded again                                                                                                   | `validChunkIds`                                            | e2e "goes on from where a failed run stopped"; break 14                              | Pass   |
| The contract          | Only the active contract's vectors count; older versions' and other contracts' vectors go once a version is complete; a stale hash is embedded again        | `contractWhere`, `finish`                                  | e2e "keeps vectors only while they can be drawn on"; breaks 15 and 16                | Pass   |
| Archived knowledge    | Archiving a source deletes its vectors and runs at once                                                                                                     | `archiveSource`                                            | e2e (archived); break 17                                                             | Pass   |
| Failures              | Codes, never words; what may pass is tried again, the rest holds; a resting model is not called; the run's deadline                                         | `embeddingFailureOf`, the router's circuit                 | unit (failures); e2e "fails in its own codes"                                        | Pass   |
| Usage                 | Every call in the ledger; the budget counts it and fails closed without a price; the requester's allowance is untouched                                     | `persist`, `embeddingBlockedBy`, `ownTokens`               | e2e "records each call"; breaks 18 and 19                                            | Pass   |
| Audit                 | Asked for, started, embedded, failed, purged — ids, codes and counts; never content, a vector or a key                                                      | `request`, `recordState`                                   | e2e "audits each step"; break 20                                                     | Pass   |
| Secrets               | The key in the request header alone: never a URL, an error, a log line, the audit, the API description or a row                                             | the Gemini adapter                                         | unit (Gemini embeddings); e2e (Gemini configured); break 21                          | Pass   |
| The index and schema  | HNSW cosine, `vector(768)`, every CHECK; Prisma's one difference is the index                                                                               | the migration                                              | e2e "stands on the HNSW cosine index"; schema diff                                   | Pass   |
| Database              | `lms` 16 → 17 (8B) → 18 (8C) under the gate; the test and preview databases match                                                                           | migrations `phase8b`, `phase8c`                            | backups, restore checks, fingerprints, migration counts                              | Pass   |

The breaks are the deliberate-break checks of session 37, each caught and restored byte for byte.

## The 8D matrix

| Area                      | Rule                                                                                                                | Where                                                         | Proof                                                                                                    | Result |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------ |
| Institutes                | Another institute's passage is never returned, however close; a client cannot name an institute                     | the search's institute condition; the strict request          | e2e "never returns another institute's passage"; breaks 1, 9 and 13                                      | Pass   |
| Publication and state     | Draft and archived sources, archived documents, older versions: never candidates, whatever the scope says           | the search's state conditions                                 | e2e "enforces publication… in the search itself", "keeps an older version out"; breaks 2 to 4, 10 and 11 | Pass   |
| Audiences                 | Staff material reaches staff; a course's, those it reaches; personal knowledge nobody                               | the reach rule; the search's data-class condition             | e2e "keeps each audience to its people"; breaks 5, 6, 8, 12 and 14                                       | Pass   |
| Course and lesson         | Context checked as the course and the player check it; it only narrows; a closed lesson's documents never appear    | the context check; the search's lesson and context conditions | e2e "draws only on the course or lesson asked from"; break 7                                             | Pass   |
| The contract              | Only the active contract's vectors, while their hash is their chunk's; the question under the same contract         | the search's contract conditions; the router                  | e2e (another model, a stale hash); break 17                                                              | Pass   |
| Permission, flags, bounds | `ai:chat`, both flags, 30 in five minutes, a strict request; nothing searched otherwise                             | `KnowledgeController`, `assertOn`                             | e2e "is for whoever may ask", "takes a question and how many passages"; breaks 15 and 16                 | Pass   |
| Ranking and selection     | Distance, then chunk id; a chunk once, a text once, two per document; K                                             | `selectPassages`                                              | unit (selection); e2e "ranks deterministically"                                                          | Pass   |
| Vectors and failures      | The question's vector checked; the provider's failures, the deadline and a slow search in the retrieval's own words | the router; `embedQuery`; `statement_timeout`                 | e2e "fails in its own words", "stops the work when the client has gone"; breaks 18 to 20                 | Pass   |
| Nothing leaks             | No vector in an answer; no question or passage in the audit, the ledger or the logs                                 | the result contract; the records                              | e2e (provenance, records); breaks 22 to 24                                                               | Pass   |
| Quality                   | Recall@5 1.0, MRR 1.0 on the evaluation set; unauthorised results nought                                            | the evaluation set                                            | e2e evaluation                                                                                           | Pass   |
| Database                  | One migration, a storage parameter: no column, index or row changed; `lms` and `lms_preview` at 19                  | the migration                                                 | backup restored and compared; status; schema diff; row fingerprints                                      | Pass   |

The breaks are the deliberate-break checks of session 38, each caught and restored byte for byte;
break 21 (a cache scope leak) does not apply, as there is no cache.

## The 8E matrix

| Area                     | Rule                                                                                                                       | Where                                                       | Proof                                                                                                      | Result |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| Reach                    | Only what retrieval returns for the person; another institute's, another course's, staff, draft, archived, personal: never | 8D's retrieval, unchanged                                   | e2e "never lets knowledge the person may not draw on reach the model"; evaluation; breaks 1, 12, 13 and 14 | Pass   |
| Data classes and secrets | A passage the provider may not be given, or holding a credential, is never sent                                            | `packEvidence`; the route's data class                      | e2e "sends only data the provider may be given"; unit; breaks 2 and 3                                      | Pass   |
| Evidence                 | Below the floor is not evidence; no evidence, no model call; no floor known, no answer                                     | `evidenceFloorFor`, `packEvidence`, the no-evidence decline | e2e "declines when nothing supports an answer", "refuses before any call"; calibration; breaks 4 and 24    | Pass   |
| Injection                | Planted and asked instructions, forged blocks and citations stay data; an answer obeying them is withheld                  | `groundedMessages`, `neutralize`, `checkAnswer`             | e2e "treats instructions planted…", "keeps instructions in the question…"; evaluation; breaks 8, 9, 10, 29 | Pass   |
| Citations                | Only the evidence's identifiers, every sentence cited, provenance from retrieval                                           | `checkAnswer`, `citationOf`                                 | e2e "accepts only citations of its evidence…"; unit; evaluation; breaks 5, 6, 7 and 15                     | Pass   |
| Retry and bounds         | Once more, then withheld; six passages, 12,000 characters, 1,024 tokens                                                    | `generate`; `KNOWLEDGE_ANSWER_LIMITS`                       | e2e (two attempts at most); unit (the bounds); breaks 16 and 17                                            | Pass   |
| Leaks                    | No instructions, code or credential in an answer; no provider's words in a failure                                         | `checkAnswer`; `failureOf`                                  | e2e "fails in its own words"; breaks 10, 11 and 20                                                         | Pass   |
| Gate                     | `ai:chat`, three flags, no timed test, 20 in five minutes, one at a time, a strict request                                 | `KnowledgeController`, `assertOn`, the policy, `acquire`    | e2e "is for whoever may ask…", "takes a question…", "refuses before any call"; breaks 19, 25, 26 and 28    | Pass   |
| Budget                   | The allowance and the institute's budget first; every call in the ledger as a question                                     | `assertWithinQuota`, `recordUsage`                          | e2e (a spent budget, the day's questions used up, the ledger and allowance); breaks 18 and 27              | Pass   |
| Streaming                | Problems before the evidence; `meta` after it; only checked text; failures as events                                       | `respond`, `writeAnswer`                                    | e2e "streams the checked answer…"; evaluation (first events); break 23                                     | Pass   |
| Records                  | One audit entry per answer and the ledger: ids, counts, codes — never the question, a passage, the answer or the code      | `record`, `recordUsage`, the log line                       | e2e "counts the question in the ledger… and audits by ids and counts"; breaks 21 and 22                    | Pass   |
| Cancellation             | The work stops when the client goes, audited as cancelled                                                                  | `respond`, `failureOf`                                      | e2e "stops the work when the client has gone"                                                              | Pass   |
| Database                 | No migration                                                                                                               | —                                                           | `prisma migrate status`; 19 migrations unchanged                                                           | Pass   |

The breaks are the deliberate-break checks of session 39, each caught and restored byte for byte.

## Rules that hold from 8A onwards

- Knowledge reaches a person only through retrieval (8D), inside the reach rule; answers (8E) draw
  on retrieval's result alone, and remove from it before anything is sent.
- The reach rule is the only answer to who may draw on a chunk, and retrieval filters by it in the
  same query, never after.
- No vector column in the knowledge tables: embeddings have tables of their own (8C), with the
  contract beside each vector, and no route returns a vector.
- The knowledge base is the institute's: no learner data is ingested in 8A, and a person's erasure
  never removes it.
- No crawling, scraping, books, paid course content or internet pages: only material the institute
  authors or uploads, and its own courses.
- A phase's migration reaches `lms` only under the database gate (runbook §5) and with the client's
  go-ahead: the 8A migration on 4 October 2026, after 8A was approved; the 8B migration the same
  day, as the 8C brief asked before any 8C work; the 8C migration the same day, as that brief asked
  once 8C was verified; the 8D migration the same day, by the 8D brief's procedure (a backup
  restored and compared, a scratch copy migrated first, then `lms_preview`, then `lms`).
- Ingestion grants nothing: publication decides what may be drawn on.

## 8A record (4 October 2026)

See the progress log, session 35.

## 8B record (4 October 2026)

See the progress log, session 36.

## 8C record (4 October 2026)

See the progress log, session 37.

## 8D record (4 October 2026)

See the progress log, session 38.

## 8E record (4 October 2026)

See the progress log, session 39.

## 8F record (5 October 2026)

See `docs/phases/PHASE-08-COMPLETION.md` and the progress log, session 40.
