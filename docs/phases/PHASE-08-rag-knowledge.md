# Phase 8 — RAG knowledge system

| Field    | Value                                                                                                                                                                                                                                                                       |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status   | **In progress** — slice 8A (knowledge architecture and vector readiness) built on 4 October 2026 and awaiting the client's review; slices 8B to 8F not started                                                                                                              |
| Scope    | The client's Phase 8A brief of 4 October 2026 ("RAG foundation, knowledge architecture and vector readiness"), after the client approved Phase 7 the same day                                                                                                               |
| Roadmap  | `docs/ROADMAP.md`, Phase 8 (RAG knowledge system). Its gate: retrieval never returns knowledge the current user is not authorised to see, proved by tests per role and scope                                                                                                |
| ADRs     | ADR-0033 (the knowledge base: visibility and provenance, 8A); ADR-0026 (vector storage readiness, with its 8A record); ADR-0027 (embeddings, with the 8A decision point); the Phase 7 rules it keeps: ADR-0024 (providers and data classes), ADR-0031 (where AI is allowed) |
| Boundary | Each slice starts only with the client's go-ahead. Phase 8 owns ingestion, embeddings, pgvector, retrieval and grounded answers. Phase 9 owns agents, tools and controlled long-term memory                                                                                 |

## Slices

| Slice  | Delivers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **8A** | **Built** (4 October 2026). Knowledge architecture and vector readiness: sources, documents, versions and chunks, with provenance the database enforces; visibility (audience and data class) and publication; deterministic content hashes; content kept through the storage driver; the reach rule retrieval will filter by; the management API behind `ai.knowledge` and `ai:knowledge_manage`; the ingestion job contract; a pgvector-ready PostgreSQL image, prepared and verified but not used |
| 8B     | Not started. Ingestion and chunking: the `ai.knowledge.ingest` job reads a version through the storage driver, cleans it, cuts it into chunks within the embedding model's input limit, and records them through the 8A claims; course material as a source, kept current by publish, update and unpublish events                                                                                                                                                                                    |
| 8C     | Not started. Embeddings and pgvector: the image adopted by local, CI and staging together; `CREATE EXTENSION vector` by a migration under the database gate; the embedding model and dimension chosen at ADR-0027's decision point; an embeddings table beside the chunks; the `ai.knowledge.embed` job; a deterministic stand-in embedder for tests                                                                                                                                                 |
| 8D     | Not started. Retrieval and grounding: similarity search filtered by the reach rule in the same query, selection, context assembly, and citations as data                                                                                                                                                                                                                                                                                                                                             |
| 8E     | Not started. Gemini RAG integration: retrieved passages in SI Academy AI's answers behind a flag of their own, the stream's reserved `sources` event, personal knowledge decided against the institute's approvals, the answer cache invalidated by knowledge changes                                                                                                                                                                                                                                |
| 8F     | Not started. Security, evaluation and the Phase 8 gate: authorised retrieval proved per role and scope, red-team cases, grounding evaluated                                                                                                                                                                                                                                                                                                                                                          |

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

## Rules that hold from 8A onwards

- Nothing reaches anyone before Phase 8D: no route or job retrieves knowledge.
- The reach rule is the only answer to who may draw on a chunk, and retrieval filters by it in the
  same query, never after.
- No vector column in the knowledge tables: embeddings get a table of their own in 8C, with the
  model and dimension beside each vector.
- The knowledge base is the institute's: no learner data is ingested in 8A, and a person's erasure
  never removes it.
- No crawling, scraping, books, paid course content or internet pages: only material the institute
  authors or uploads, and its own courses.
- The 8A migration reaches `lms` only after the client reviews the 8A schema (runbook §5).

## 8A record (4 October 2026)

See the progress log, session 35.
