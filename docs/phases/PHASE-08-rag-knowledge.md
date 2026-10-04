# Phase 8 — RAG knowledge system

| Field    | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status   | **In progress** — slice 8A (knowledge architecture and vector readiness) built and approved on 4 October 2026, its migration on `lms` the same day; slice 8B (ingestion and chunking) built and approved on 4 October 2026 (the client's Phase 8C brief), its migration on `lms` the same day; slice 8C (embeddings and pgvector) built on 4 October 2026, its migration on `lms` the same day as its brief asked, and awaiting the client's review; slices 8D to 8F not started |
| Scope    | The client's Phase 8A brief of 4 October 2026 ("RAG foundation, knowledge architecture and vector readiness"), after the client approved Phase 7 the same day; the Phase 8B brief of the same day ("knowledge ingestion, parsing, normalization and chunking"); and the Phase 8C brief of the same day ("embeddings + pgvector")                                                                                                                                                 |
| Roadmap  | `docs/ROADMAP.md`, Phase 8 (RAG knowledge system). Its gate: retrieval never returns knowledge the current user is not authorised to see, proved by tests per role and scope                                                                                                                                                                                                                                                                                                     |
| ADRs     | ADR-0033 (the knowledge base: visibility and provenance, 8A); ADR-0034 (ingestion and chunking, 8B); ADR-0035 (embeddings and pgvector, 8C); ADR-0026 (vector storage, with its 8A and 8C records); ADR-0027 (embeddings, with the 8A decision point and the 8C decision); the Phase 7 rules it keeps: ADR-0024 (providers and data classes), ADR-0025 (the model router), ADR-0029 (usage and budgets), ADR-0031 (where AI is allowed)                                          |
| Boundary | Each slice starts only with the client's go-ahead. Phase 8 owns ingestion, embeddings, pgvector, retrieval and grounded answers. Phase 9 owns agents, tools and controlled long-term memory                                                                                                                                                                                                                                                                                      |

## Slices

| Slice  | Delivers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **8A** | **Built and approved** (4 October 2026). Knowledge architecture and vector readiness: sources, documents, versions and chunks, with provenance the database enforces; visibility (audience and data class) and publication; deterministic content hashes; content kept through the storage driver; the reach rule retrieval will filter by; the management API behind `ai.knowledge` and `ai:knowledge_manage`; the ingestion job contract; a pgvector-ready PostgreSQL image, prepared and verified but not used                                                                                                  |
| **8B** | **Built and approved** (4 October 2026). Ingestion and chunking (ADR-0034): Markdown, plain text and HTML read into their structure and normalised; a deterministic, structure-aware chunker; the `ai.knowledge.ingest` job on the queue, with a leased claim, its checks, a bounded read, the content's hash verified and every chunk recorded in one transaction; deterministic chunk identities; failure codes; the request and status routes; the hand-over to 8C. Not built: automatic ingestion of course material (see "Deviation")                                                                         |
| **8C** | **Built** (4 October 2026). Embeddings and pgvector (ADR-0035): the pgvector image adopted by local, CI and staging; `gemini-embedding-001` at 768 dimensions, chosen from Google's documentation; embeddings in the provider abstraction (the fake's and Gemini's), behind the model router; the `vector` extension and two tables beside the chunks, `vector(768)` at unit length with an HNSW cosine index; the embedding contract and its invalidation; the `ai.knowledge.embed` job, claimed, leased, fenced and batched; usage in the ledger and the budget; the request route. Nothing compares vectors yet |
| 8D     | Not started. Retrieval and grounding: similarity search filtered by the reach rule in the same query, selection, context assembly, and citations as data                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 8E     | Not started. Gemini RAG integration: retrieved passages in SI Academy AI's answers behind a flag of their own, the stream's reserved `sources` event, personal knowledge decided against the institute's approvals, the answer cache invalidated by knowledge changes                                                                                                                                                                                                                                                                                                                                              |
| 8F     | Not started. Security, evaluation and the Phase 8 gate: authorised retrieval proved per role and scope, red-team cases, grounding evaluated                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

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

## Deviation: course material

This plan first placed automatic ingestion of course material in 8B — lessons as documents, kept
current by publish, update and unpublish events. The client's 8B brief does not ask for it, and 8B
does not build it. A course source can hold lesson documents whose versions an administrator adds
(HTML or Markdown) and ingests today. Building the automatic path, and in which slice, is the
client's decision.

## Deferred items — carried forward

Each item stays here until a slice takes it up, with the client's go-ahead; none is built because it
is listed.

| Item                                     | From    | Where it stands                                                                                | When                                                     |
| ---------------------------------------- | ------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| The 8B migration on `lms`                | 8B      | Done on 4 October 2026, under the database gate, before any 8C work (progress log, session 37) | —                                                        |
| ADR-0034                                 | 8B      | Accepted; the authoritative ingestion and chunking decision                                    | —                                                        |
| Automatic ingestion of course material   | 8B plan | Not built (see "Deviation"); lesson documents are added and ingested by hand                   | A later slice, on the client's decision                  |
| PDF; Word, PowerPoint and OCR            | 8B      | Not read; a PDF is refused when a version is created                                           | Before production RAG, if the real corpus needs it       |
| Topics, skills, batch and role audiences | 8A      | Not in the model                                                                               | A later slice with a migration, if the client wants them |
| Purging knowledge                        | 8A      | Archiving withdraws a source and now deletes its vectors; nothing deletes knowledge            | When asked for                                           |
| Re-chunking under a new chunker version  | 8B      | No path yet                                                                                    | When a chunker version changes                           |
| Personal knowledge                       | 8A      | Held back: neither retrieved nor embedded                                                      | 8E                                                       |
| Automatic and bulk embedding             | 8C      | A version is asked for; a new contract is applied version by version                           | When a contract changes, or the client asks              |
| A live Gemini embedding                  | 8C      | Not made: no key on the development machine; the smoke script is ready                         | The developer, with a paid-tier key                      |
| A price for `gemini-embedding-001`       | 8C      | Google lists none; needed only with a monthly budget                                           | The institute, from its own billing                      |
| CI's image from a registry               | 8C      | Built on each run                                                                              | If the build time matters                                |
| Prisma and the HNSW index                | 8C      | Raw SQL; a schema diff shows its `DROP INDEX`, never to be applied                             | Until Prisma can describe HNSW                           |
| The reach rule under load                | 8A      | Not measured                                                                                   | 8D                                                       |

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

## Rules that hold from 8A onwards

- Nothing reaches anyone before Phase 8D: no route or job retrieves knowledge.
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
  once 8C was verified.
- Ingestion grants nothing: publication decides what may be drawn on.

## 8A record (4 October 2026)

See the progress log, session 35.

## 8B record (4 October 2026)

See the progress log, session 36.

## 8C record (4 October 2026)

See the progress log, session 37.
